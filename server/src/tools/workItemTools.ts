/**
 * Custom Copilot SDK tools for Azure DevOps work item analysis and creation.
 */
import { exec } from "child_process";
import { config } from "../config.js";

const ADO_ORG = config.adoOrgUrl;

const toolLog = {
    info: (tool: string, msg: string) => console.log(`[TOOL:${tool}] ℹ️  ${msg}`),
    error: (tool: string, msg: string) => console.error(`[TOOL:${tool}] ❌ ${msg}`),
    success: (tool: string, msg: string) => console.log(`[TOOL:${tool}] ✅ ${msg}`),
};

// Lazy-load defineTool from the ESM-only SDK
let _defineTool: any;
async function getDefineTool(): Promise<any> {
    if (!_defineTool) {
        const sdk = await import("@github/copilot-sdk");
        _defineTool = sdk.defineTool;
    }
    return _defineTool;
}

// Helper: run az CLI command
function runAzCommand(toolName: string, command: string, adoToken: string, extraEnv?: Record<string, string>): Promise<any> {
    const safeCmd = command.replace(/AZURE_DEVOPS_EXT_PAT=[^\s]+/g, "AZURE_DEVOPS_EXT_PAT=***");
    toolLog.info(toolName, `Executing: ${safeCmd}`);

    return new Promise((resolve, reject) => {
        exec(command, {
            env: { ...process.env, AZURE_DEVOPS_EXT_PAT: adoToken, ...extraEnv },
            maxBuffer: 10 * 1024 * 1024,
        }, (error, stdout, stderr) => {
            if (error) {
                toolLog.error(toolName, `Failed: ${stderr || error.message}`);
                reject(new Error(`Command failed: ${stderr || error.message}`));
                return;
            }
            try {
                const result = JSON.parse(stdout);
                toolLog.success(toolName, "Success");
                resolve(result);
            } catch {
                toolLog.success(toolName, "Success (non-JSON)");
                resolve(stdout.trim());
            }
        });
    });
}

function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function hasNonRootPath(value: unknown): boolean {
    const path = normalizeText(value);
    if (!path) {
        return false;
    }

    return path.includes("\\");
}

function looksLikeWellFormedStoryTitle(title: string): boolean {
    if (!title) {
        return false;
    }

    if (/as\s+(an?|the)\s+.+?\s*,?\s*i\s+want\s+.+?\s*,?\s*so\s+that\s+.+/i.test(title)) {
        return true;
    }

    const words = title.split(/\s+/).filter(Boolean);
    return words.length >= 6 && /want|need|allow|enable|view|create|manage|update|see|track/i.test(title);
}

function extractChildRelations(relations: any[]): any[] {
    return relations.filter((relation) => {
        const rel = String(relation?.rel || "").toLowerCase();
        const name = String(relation?.attributes?.name || "").toLowerCase();
        return rel.includes("hierarchy-forward") || name.includes("child");
    });
}

function extractWorkItemIdFromUrl(url: unknown): number | null {
    const match = String(url || "").match(/workItems\/(\d+)/i);
    return match ? Number(match[1]) : null;
}

export async function createWorkItemTools(adoToken: string): Promise<any[]> {
    const defineTool = await getDefineTool();
    const { z } = await import("zod");

    const validateWorkItem = defineTool("validate_work_item", {
        description: "Reads a work item from Azure DevOps and validates that it has all required fields for a well-defined story",
        parameters: z.object({
            workItemId: z.number().int().positive().describe("Azure DevOps work item ID to validate"),
        }),
        handler: async ({ workItemId }: { workItemId: number }) => {
            const workItem = await runAzCommand(
                "validate_work_item",
                `az boards work-item show --id ${workItemId} --org ${shellQuote(ADO_ORG)} --output json`,
                adoToken,
            );

            const fields = workItem?.fields || {};
            const title = normalizeText(fields["System.Title"]);
            const description = normalizeText(fields["System.Description"]);
            const acceptanceCriteria = normalizeText(fields["Microsoft.VSTS.Common.AcceptanceCriteria"]);
            const storyPoints = fields["Microsoft.VSTS.Scheduling.StoryPoints"];
            const tags = normalizeText(fields["System.Tags"]);
            const areaPath = normalizeText(fields["System.AreaPath"]);
            const iterationPath = normalizeText(fields["System.IterationPath"]);

            const checks = [
                {
                    field: "Title",
                    valid: !!title && looksLikeWellFormedStoryTitle(title),
                    message: "Title should clearly express the user need, ideally in 'As a... I want... So that...' format.",
                },
                {
                    field: "Description",
                    valid: !!description,
                    message: "Description should not be empty.",
                },
                {
                    field: "Acceptance Criteria",
                    valid: !!acceptanceCriteria,
                    message: "Acceptance Criteria should not be empty.",
                },
                {
                    field: "Story Points",
                    valid: storyPoints !== null && storyPoints !== undefined && String(storyPoints).trim() !== "",
                    message: "Story Points should have a value.",
                },
                {
                    field: "Tags",
                    valid: !!tags,
                    message: "Tags should not be empty.",
                },
                {
                    field: "Area Path",
                    valid: hasNonRootPath(areaPath),
                    message: "Area Path should be more specific than the project root.",
                },
                {
                    field: "Iteration Path",
                    valid: hasNonRootPath(iterationPath),
                    message: "Iteration Path should be more specific than the project root.",
                },
            ];

            const issues = checks
                .filter((check) => !check.valid)
                .map((check) => ({
                    field: check.field,
                    message: check.message,
                }));

            const passedChecks = checks.length - issues.length;
            const validationScore = Math.round((passedChecks / checks.length) * 100);

            return {
                workItemId,
                title,
                type: fields["System.WorkItemType"] || workItem?.fields?.["System.WorkItemType"] || "Unknown",
                validationScore,
                issues,
                summary: issues.length === 0
                    ? "This work item looks well-defined and ready for refinement or delivery."
                    : `Validation found ${issues.length} gap(s). ${passedChecks}/${checks.length} checks passed.`,
            };
        },
    });

    const generateAcceptanceCriteria = defineTool("generate_acceptance_criteria", {
        description: "Generates acceptance criteria in Given-When-Then format for a user story. This is a helper that returns structured text — it does NOT call Azure DevOps.",
        parameters: z.object({
            title: z.string().min(1).describe("User story title"),
            description: z.string().optional().describe("Optional user story description"),
        }),
        handler: async ({ title, description }: { title: string; description?: string }) => ({
            note: "The LLM should generate the acceptance criteria based on the title and description provided. Use Given-When-Then format with multiple scenarios.",
            title,
            description: description || "",
        }),
    });

    const decomposeFeature = defineTool("decompose_feature", {
        description: "Reads a feature or epic work item and its child items to help suggest decomposition into smaller user stories",
        parameters: z.object({
            workItemId: z.number().int().positive().describe("Azure DevOps feature or epic work item ID"),
        }),
        handler: async ({ workItemId }: { workItemId: number }) => {
            const workItem = await runAzCommand(
                "decompose_feature",
                `az boards work-item show --id ${workItemId} --org ${shellQuote(ADO_ORG)} --output json`,
                adoToken,
            );

            const relationData = await runAzCommand(
                "decompose_feature",
                `az boards work-item relation show --id ${workItemId} --org ${shellQuote(ADO_ORG)} --output json`,
                adoToken,
            );

            const relations = Array.isArray(relationData?.relations) ? relationData.relations : [];
            const childRelations = extractChildRelations(relations);
            const childIds = childRelations
                .map((relation) => extractWorkItemIdFromUrl(relation?.url))
                .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

            const childItems = await Promise.all(childIds.map((childId) => runAzCommand(
                "decompose_feature",
                `az boards work-item show --id ${childId} --org ${shellQuote(ADO_ORG)} --output json`,
                adoToken,
            )));

            return {
                workItem,
                relations,
                childItems,
                summary: `Loaded work item ${workItemId} with ${relations.length} relation(s) and ${childItems.length} child item(s).`,
            };
        },
    });

    const createUserStory = defineTool("create_user_story", {
        description: "Creates a new User Story work item in Azure DevOps with complete fields",
        parameters: z.object({
            title: z.string().min(1).describe("User story title"),
            description: z.string().min(1).describe("User story description"),
            acceptanceCriteria: z.string().min(1).describe("Acceptance criteria text"),
            project: z.string().min(1).describe("Azure DevOps project name"),
            areaPath: z.string().optional().describe("Optional area path"),
            iterationPath: z.string().optional().describe("Optional iteration path"),
            storyPoints: z.number().positive().optional().describe("Optional story points estimate"),
            tags: z.string().optional().describe("Optional semicolon-separated tags"),
            parentId: z.number().int().positive().optional().describe("Optional parent work item ID"),
        }),
        handler: async (args: {
            title: string;
            description: string;
            acceptanceCriteria: string;
            project: string;
            areaPath?: string;
            iterationPath?: string;
            storyPoints?: number;
            tags?: string;
            parentId?: number;
        }) => {
            const fieldArgs = [
                `Microsoft.VSTS.Common.AcceptanceCriteria=${args.acceptanceCriteria}`,
                ...(args.storyPoints !== undefined ? [`Microsoft.VSTS.Scheduling.StoryPoints=${args.storyPoints}`] : []),
                ...(args.tags ? [`System.Tags=${args.tags}`] : []),
                ...(args.areaPath ? [`System.AreaPath=${args.areaPath}`] : []),
                ...(args.iterationPath ? [`System.IterationPath=${args.iterationPath}`] : []),
                ...(args.parentId !== undefined ? [`System.Parent=${args.parentId}`] : []),
            ];

            const fieldsSegment = fieldArgs.length > 0
                ? ` --fields ${fieldArgs.map((field) => shellQuote(field)).join(" ")}`
                : "";

            const command =
                `az boards work-item create --type "User Story"` +
                ` --title ${shellQuote(args.title)}` +
                ` --description ${shellQuote(args.description)}` +
                ` --project ${shellQuote(args.project)}` +
                ` --org ${shellQuote(ADO_ORG)}` +
                `${fieldsSegment} --output json`;

            return runAzCommand("create_user_story", command, adoToken);
        },
    });

    return [validateWorkItem, generateAcceptanceCriteria, decomposeFeature, createUserStory];
}
