/**
 * Custom Copilot SDK tools for Azure DevOps project scaffolding.
 *
 * These tools allow the Copilot agent to create projects, repositories, and
 * import Quickstart templates using the `az devops` CLI — giving it deterministic,
 * well-defined actions instead of free-form MCP calls.
 */
import { exec } from "child_process";

const ADO_ORG = "https://dev.azure.com/returngisorg";

// Simple logger for tool execution
const toolLog = {
    info: (tool: string, msg: string) => console.log(`[TOOL:${tool}] ℹ️  ${msg}`),
    error: (tool: string, msg: string) => console.error(`[TOOL:${tool}] ❌ ${msg}`),
    success: (tool: string, msg: string) => console.log(`[TOOL:${tool}] ✅ ${msg}`),
};

// ── Lazy-load defineTool from the ESM-only SDK ──────────────────
let _defineTool: any;
async function getDefineTool(): Promise<any> {
    if (!_defineTool) {
        const sdk = await import("@github/copilot-sdk");
        _defineTool = sdk.defineTool;
    }
    return _defineTool;
}

// ── Helper: run az CLI command ──────────────────────────────────
function runAzCommand(toolName: string, command: string, adoToken: string, extraEnv?: Record<string, string>): Promise<any> {
    // Mask token in logged command
    const safeCmd = command.replace(/AZURE_DEVOPS_EXT_PAT=[^\s]+/g, "AZURE_DEVOPS_EXT_PAT=***");
    toolLog.info(toolName, `Executing: ${safeCmd}`);

    return new Promise((resolve, reject) => {
        exec(command, {
            env: {
                ...process.env,
                AZURE_DEVOPS_EXT_PAT: adoToken,
                ...extraEnv,
            },
            timeout: 120_000, // 2 min max per command
        }, (error, stdout, stderr) => {
            if (stderr?.trim()) {
                toolLog.info(toolName, `stderr: ${stderr.trim()}`);
            }
            if (error) {
                const msg = stderr?.trim() || error.message;
                toolLog.error(toolName, `FAILED: ${msg}`);
                toolLog.error(toolName, `stdout was: ${stdout?.trim() || "(empty)"}`);
                reject(new Error(`az CLI error: ${msg}`));
                return;
            }
            toolLog.info(toolName, `stdout: ${stdout?.trim().substring(0, 500)}`);
            try {
                resolve(JSON.parse(stdout));
            } catch {
                // Some commands return non-JSON output
                resolve({ output: stdout.trim() });
            }
        });
    });
}

/**
 * Check if a resource exists by running a `show` command.
 * Returns the parsed JSON result if it exists, or null if not found.
 */
function azExists(toolName: string, command: string, adoToken: string): Promise<any | null> {
    return new Promise((resolve) => {
        exec(command, {
            env: {
                ...process.env,
                AZURE_DEVOPS_EXT_PAT: adoToken,
            },
            timeout: 30_000,
        }, (error, stdout) => {
            if (error) {
                toolLog.info(toolName, `Pre-check: resource does not exist (expected)`);
                resolve(null);
                return;
            }
            try {
                const result = JSON.parse(stdout);
                toolLog.info(toolName, `Pre-check: resource already exists (id: ${result.id || 'unknown'})`);
                resolve(result);
            } catch {
                resolve(null);
            }
        });
    });
}

/**
 * Delete a repo by ID. Used to remove the default repo ADO creates with a new project.
 */
function azDeleteRepo(toolName: string, repoId: string, project: string, adoToken: string): Promise<void> {
    const command = `az repos delete --id "${repoId}" --project "${project}" --org ${ADO_ORG} --yes`;
    toolLog.info(toolName, `Deleting default repo ${repoId} in project "${project}"...`);
    return new Promise((resolve, reject) => {
        exec(command, {
            env: {
                ...process.env,
                AZURE_DEVOPS_EXT_PAT: adoToken,
            },
            timeout: 30_000,
        }, (error, _stdout, stderr) => {
            if (error) {
                const msg = stderr?.trim() || error.message;
                toolLog.error(toolName, `Failed to delete default repo: ${msg}`);
                // Non-fatal: continue even if delete fails
                resolve();
                return;
            }
            toolLog.success(toolName, `Default repo deleted successfully`);
            resolve();
        });
    });
}

/**
 * Wait for a newly created project to be fully provisioned.
 * ADO returns from `project create` before Git repos are available.
 * Polls `project show` until state is "wellFormed" or max retries reached.
 */
function waitForProjectReady(toolName: string, projectName: string, adoToken: string): Promise<void> {
    const MAX_RETRIES = 15;
    const INTERVAL_MS = 4_000; // 4 seconds between checks

    return new Promise((resolve) => {
        let attempt = 0;

        const check = () => {
            attempt++;
            toolLog.info(toolName, `Waiting for project "${projectName}" to be ready (attempt ${attempt}/${MAX_RETRIES})...`);

            exec(
                `az devops project show --project "${projectName}" --org ${ADO_ORG} --output json`,
                {
                    env: { ...process.env, AZURE_DEVOPS_EXT_PAT: adoToken },
                    timeout: 15_000,
                },
                (error, stdout) => {
                    if (!error && stdout) {
                        try {
                            const project = JSON.parse(stdout);
                            const state = project.state || "";
                            toolLog.info(toolName, `Project state: "${state}"`);
                            if (state.toLowerCase() === "wellformed") {
                                toolLog.success(toolName, `Project "${projectName}" is ready!`);
                                resolve();
                                return;
                            }
                        } catch { /* ignore parse errors */ }
                    }

                    if (attempt >= MAX_RETRIES) {
                        toolLog.info(toolName, `Max retries reached, proceeding anyway`);
                        resolve();
                        return;
                    }

                    setTimeout(check, INTERVAL_MS);
                },
            );
        };

        check();
    });
}

/**
 * Delete all default repos that ADO creates when a new project is created.
 * Uses `az repos list` with retries since Git may take a moment to be available.
 */
function deleteDefaultRepos(toolName: string, projectName: string, adoToken: string): Promise<void> {
    const MAX_RETRIES = 5;
    const INTERVAL_MS = 3_000;

    return new Promise((resolve) => {
        let attempt = 0;

        const tryDelete = () => {
            attempt++;
            toolLog.info(toolName, `Listing repos in "${projectName}" to delete defaults (attempt ${attempt}/${MAX_RETRIES})...`);

            exec(
                `az repos list --project "${projectName}" --org ${ADO_ORG} --output json`,
                {
                    env: { ...process.env, AZURE_DEVOPS_EXT_PAT: adoToken },
                    timeout: 30_000,
                },
                async (error, stdout) => {
                    if (error || !stdout?.trim()) {
                        if (attempt >= MAX_RETRIES) {
                            toolLog.info(toolName, `Could not list repos after ${MAX_RETRIES} attempts, proceeding`);
                            resolve();
                            return;
                        }
                        setTimeout(tryDelete, INTERVAL_MS);
                        return;
                    }

                    try {
                        const repos = JSON.parse(stdout);
                        if (!Array.isArray(repos) || repos.length === 0) {
                            toolLog.info(toolName, `No repos found to delete`);
                            resolve();
                            return;
                        }

                        toolLog.info(toolName, `Found ${repos.length} default repo(s) to delete: ${repos.map((r: any) => r.name).join(", ")}`);
                        for (const repo of repos) {
                            if (repo.id) {
                                await azDeleteRepo(toolName, repo.id, projectName, adoToken);
                            }
                        }
                        resolve();
                    } catch {
                        if (attempt >= MAX_RETRIES) {
                            resolve();
                            return;
                        }
                        setTimeout(tryDelete, INTERVAL_MS);
                    }
                },
            );
        };

        tryDelete();
    });
}

/**
 * Creates all the ADO project scaffolding tools for the Copilot session.
 * Must be called async because defineTool comes from an ESM module.
 *
 * @param adoToken - The Azure DevOps bearer token from the current user
 */
export async function createAdoProjectTools(adoToken: string) {
    const defineTool = await getDefineTool();

    // ── 1. Create an Azure DevOps project ───────────────────────
    const createProject = defineTool("create_ado_project", {
        description:
            "Create a new Azure DevOps project in the organization (returngisorg). " +
            "Use this when the user wants to start a new project. " +
            "Returns the project details including its ID and URL.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Name for the new project (e.g. 'my-web-app')",
                },
                description: {
                    type: "string",
                    description: "Short description of the project",
                },
            },
            required: ["name"],
        },
        handler: async (args: { name: string; description?: string }) => {
            toolLog.info("create_ado_project", `Checking if project "${args.name}" already exists...`);

            // Pre-check: does the project already exist?
            const existing = await azExists(
                "create_ado_project",
                `az devops project show --project "${args.name}" --org ${ADO_ORG} --output json`,
                adoToken,
            );
            if (existing) {
                toolLog.info("create_ado_project", `Project "${args.name}" already exists, skipping creation`);
                return {
                    success: true,
                    alreadyExisted: true,
                    project: {
                        id: existing.id,
                        name: existing.name || args.name,
                        url: `${ADO_ORG}/${encodeURIComponent(args.name)}`,
                        state: existing.state,
                    },
                };
            }

            toolLog.info("create_ado_project", `Creating project "${args.name}"`);
            const descFlag = args.description
                ? ` --description "${args.description.replace(/"/g, '\\"')}"`
                : "";

            const result = await runAzCommand(
                "create_ado_project",
                `az devops project create --name "${args.name}"${descFlag}` +
                ` --source-control git --org ${ADO_ORG} --output json`,
                adoToken,
            );
            toolLog.success("create_ado_project", `Project created: ${result.id}`);

            // Wait for the project to be fully provisioned (Git repos, etc.)
            await waitForProjectReady("create_ado_project", args.name, adoToken);

            // ADO creates a default repo with the same name as the project — delete it
            // so it doesn't conflict with the repo the user wants to create next.
            // Use `az repos list` with retries since Git may take a moment after project is ready.
            await deleteDefaultRepos("create_ado_project", args.name, adoToken);

            return {
                success: true,
                alreadyExisted: false,
                project: {
                    id: result.id,
                    name: result.name || args.name,
                    url: `${ADO_ORG}/${encodeURIComponent(args.name)}`,
                    state: result.state,
                },
            };
        },
    });

    // ── 2. Create a repository inside a project ─────────────────
    const createRepo = defineTool("create_ado_repo", {
        description:
            "Create a new empty Git repository inside an existing Azure DevOps project. " +
            "Use this after creating a project to prepare a repo for importing a Quickstart template.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Name for the new repository",
                },
                project: {
                    type: "string",
                    description: "Name of the Azure DevOps project where the repo will be created",
                },
            },
            required: ["name", "project"],
        },
        handler: async (args: { name: string; project: string }) => {
            toolLog.info("create_ado_repo", `Checking if repo "${args.name}" exists in project "${args.project}"...`);

            // Pre-check: does the repo already exist?
            const existing = await azExists(
                "create_ado_repo",
                `az repos show --repository "${args.name}"` +
                ` --project "${args.project}" --org ${ADO_ORG} --output json`,
                adoToken,
            );
            if (existing) {
                toolLog.info("create_ado_repo", `Repo "${args.name}" already exists in project "${args.project}", skipping creation`);
                return {
                    success: true,
                    alreadyExisted: true,
                    repository: {
                        id: existing.id,
                        name: existing.name || args.name,
                        webUrl: existing.webUrl || existing.remoteUrl,
                        cloneUrl: existing.remoteUrl,
                    },
                };
            }

            toolLog.info("create_ado_repo", `Creating repo "${args.name}" in project "${args.project}"`);
            const result = await runAzCommand(
                "create_ado_repo",
                `az repos create --name "${args.name}"` +
                ` --project "${args.project}" --org ${ADO_ORG} --output json`,
                adoToken,
            );
            toolLog.success("create_ado_repo", `Repo created: ${result.id}`);

            return {
                success: true,
                alreadyExisted: false,
                repository: {
                    id: result.id,
                    name: result.name || args.name,
                    webUrl: result.webUrl || result.remoteUrl,
                    cloneUrl: result.remoteUrl,
                },
            };
        },
    });

    // ── 3. Import a Quickstart template into a repo ─────────────
    const importRepo = defineTool("import_quickstart_repo", {
        description:
            "Import (copy) a Quickstart template repository into a target repository. " +
            "This clones the source repo contents server-side (no local clone needed). " +
            "Use this after creating a repo to populate it with a Quickstart template. " +
            "The sourceUrl must be the clone URL of a repo from the Quickstarts project.",
        parameters: {
            type: "object",
            properties: {
                sourceUrl: {
                    type: "string",
                    description:
                        "Git clone URL of the Quickstart template repo to import from " +
                        "(e.g. 'https://returngisorg@dev.azure.com/returngisorg/Quickstarts/_git/react-quickstart')",
                },
                repository: {
                    type: "string",
                    description: "Name of the target repository where code will be imported",
                },
                project: {
                    type: "string",
                    description: "Name of the Azure DevOps project that contains the target repository",
                },
            },
            required: ["sourceUrl", "repository", "project"],
        },
        handler: async (args: { sourceUrl: string; repository: string; project: string }) => {
            toolLog.info("import_quickstart_repo", `Importing "${args.sourceUrl}" → repo "${args.repository}" in project "${args.project}"`);
            const result = await runAzCommand(
                "import_quickstart_repo",
                `az repos import create --git-source-url "${args.sourceUrl}"` +
                ` --repository "${args.repository}"` +
                ` --project "${args.project}" --org ${ADO_ORG}` +
                ` --requires-authorization --output json`,
                adoToken,
                // import needs the source PAT in a separate env var
                { AZURE_DEVOPS_EXT_GIT_SOURCE_PASSWORD_OR_PAT: adoToken },
            );
            toolLog.success("import_quickstart_repo", `Import completed: status=${result.status || "done"}`);

            return {
                success: true,
                import: {
                    status: result.status || "completed",
                    sourceUrl: args.sourceUrl,
                    targetRepo: args.repository,
                    targetProject: args.project,
                    projectUrl: `${ADO_ORG}/${encodeURIComponent(args.project)}`,
                    repoUrl: `${ADO_ORG}/${encodeURIComponent(args.project)}/_git/${encodeURIComponent(args.repository)}`,
                },
            };
        },
    });

    // ── 4. Set up a pipeline for the imported repo ───────────────
    const setupPipeline = defineTool("setup_ado_pipeline", {
        description:
            "Create an Azure DevOps YAML pipeline for a repository. " +
            "Use this after importing a Quickstart template to set up CI/CD. " +
            "The pipeline will point to the azure-pipelines.yml file in the repo.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "Name for the pipeline (e.g. 'Build & Deploy')",
                },
                repository: {
                    type: "string",
                    description: "Name of the repository that contains the pipeline YAML",
                },
                project: {
                    type: "string",
                    description: "Name of the Azure DevOps project",
                },
                yamlPath: {
                    type: "string",
                    description: "Path to the YAML pipeline file in the repo (default: azure-pipelines.yml)",
                },
                branch: {
                    type: "string",
                    description: "Branch to configure the pipeline for (default: main)",
                },
            },
            required: ["name", "repository", "project"],
        },
        handler: async (args: {
            name: string;
            repository: string;
            project: string;
            yamlPath?: string;
            branch?: string;
        }) => {
            const yamlPath = args.yamlPath || "azure-pipelines.yml";
            const branch = args.branch || "main";

            toolLog.info("setup_ado_pipeline", `Creating pipeline "${args.name}" for repo "${args.repository}" in project "${args.project}"`);

            const result = await runAzCommand(
                "setup_ado_pipeline",
                `az pipelines create --name "${args.name}"` +
                ` --repository "${args.repository}" --repository-type tfsgit` +
                ` --branch "${branch}" --yml-path "${yamlPath}"` +
                ` --project "${args.project}" --org ${ADO_ORG}` +
                ` --output json`,
                adoToken,
            );
            toolLog.success("setup_ado_pipeline", `Pipeline created: ${result.id || 'ok'}`);

            return {
                success: true,
                pipeline: {
                    id: result.id,
                    name: result.name || args.name,
                    url: `${ADO_ORG}/${encodeURIComponent(args.project)}/_build?definitionId=${result.id}`,
                    yamlPath,
                    branch,
                },
            };
        },
    });

    return [createProject, createRepo, importRepo, setupPipeline];
}
