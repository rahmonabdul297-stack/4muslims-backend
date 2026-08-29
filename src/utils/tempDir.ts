import fs from "fs";
import path from "path";

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
  return path.join(process.cwd(), "tmp", sanitizeJobId(jobId));
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
