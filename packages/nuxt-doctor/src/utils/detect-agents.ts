import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

export type SupportedAgent =
  | "claude"
  | "codex"
  | "copilot"
  | "gemini"
  | "cursor"
  | "opencode"
  | "droid"
  | "pi";

interface AgentMeta {
  readonly binaries: readonly string[];
  readonly displayName: string;
  readonly skillDir: string;
}

const AGENTS_SKILL_DIR = ".agents/skills";

const SUPPORTED_AGENTS: Record<SupportedAgent, AgentMeta> = {
  claude: { binaries: ["claude"], displayName: "Claude Code", skillDir: ".claude/skills" },
  codex: { binaries: ["codex"], displayName: "Codex", skillDir: AGENTS_SKILL_DIR },
  copilot: { binaries: ["copilot"], displayName: "GitHub Copilot", skillDir: AGENTS_SKILL_DIR },
  gemini: { binaries: ["gemini"], displayName: "Gemini CLI", skillDir: AGENTS_SKILL_DIR },
  cursor: { binaries: ["cursor", "agent"], displayName: "Cursor", skillDir: AGENTS_SKILL_DIR },
  opencode: { binaries: ["opencode"], displayName: "OpenCode", skillDir: AGENTS_SKILL_DIR },
  droid: { binaries: ["droid"], displayName: "Factory Droid", skillDir: ".factory/skills" },
  pi: { binaries: ["pi", "omegon"], displayName: "Pi", skillDir: AGENTS_SKILL_DIR },
};

export const ALL_SUPPORTED_AGENTS = Object.keys(SUPPORTED_AGENTS) as SupportedAgent[];

const isCommandAvailable = (command: string): boolean => {
  const pathDirectories = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const directory of pathDirectories) {
    const binaryPath = path.join(directory, command);
    try {
      if (statSync(binaryPath).isFile()) {
        accessSync(binaryPath, constants.X_OK);
        return true;
      }
    } catch {}
  }
  return false;
};

export const detectAvailableAgents = (): SupportedAgent[] =>
  ALL_SUPPORTED_AGENTS.filter((agent) => SUPPORTED_AGENTS[agent].binaries.some(isCommandAvailable));

export const toDisplayName = (agent: SupportedAgent): string => SUPPORTED_AGENTS[agent].displayName;

export const toSkillDir = (agent: SupportedAgent): string => SUPPORTED_AGENTS[agent].skillDir;
