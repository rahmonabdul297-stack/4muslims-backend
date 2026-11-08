import fs from "fs";
import os from "os";
import path from "path";

const jobTempRoot = path.join(os.tmpdir(), "4muslims", "jobs");

// Strip anything but safe path segment characters to block traversal via job ids
const sanitizeJobId = (jobId: string): string => {
  const clean = jobId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) {
    throw new Error(
      "Invalid jobId: must contain at least one alphanumeric, dash, or underscore character.",
    );
  }
  return clean;
};

export const getJobTempDir = (jobId: string): string => {
  return path.join(jobTempRoot, sanitizeJobId(jobId));
};

export const ensureJobTempDir = async (jobId: string): Promise<string> => {
  const dir = getJobTempDir(jobId);
  await fs.promises.mkdir(dir, { recursive: true });
  return dir;
};

export const clearJobTempDir = async (jobId: string): Promise<void> => {
  const dir = getJobTempDir(jobId);
  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
};

/**
 * Empty only this app's job scratch directory when its persistent worker starts.
 */
export const clearAllTempDirs = async (): Promise<void> => {
  const dirs = [jobTempRoot];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const entries = await fs.promises.readdir(dir);
    await Promise.all(
      entries.map((entry) =>
        fs.promises
          .rm(path.join(dir, entry), { recursive: true, force: true })
          .catch((err) => {
            console.warn(
              `[startupCleanup] Failed to remove ${path.join(dir, entry)}:`,
              (err as Error).message,
            );
          }),
      ),
    );

    if (entries.length > 0) {
      console.log(
        `[startupCleanup] Cleared ${entries.length} leftover item(s) from ${dir}`,
      );
    }
  }
};
