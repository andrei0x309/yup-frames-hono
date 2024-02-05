import * as fs from "fs";
import * as path from "path";

async function copyFolderRecursively(source: string, destination: string): Promise<void> {
  try {
    await fs.promises.mkdir(destination, { recursive: true }); // Create destination directory if needed

    const entries = await fs.promises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await copyFolderRecursively(sourcePath, destinationPath);
      } else if (entry.isFile()) {
        await fs.promises.copyFile(sourcePath, destinationPath);
      }
    }
  } catch (error) {
    console.error("Error copying folder:", error);
    throw error; // Re-throw to allow for proper handling upstream
  }
}

async function copyPublic(): Promise<void> {
  const source = path.join(__dirname, "../public");
  const destination = path.join(__dirname, "../build/public");

  await copyFolderRecursively(source, destination);
}

copyPublic().catch((error) => {
  console.error("Error copying public folder:", error);
  process.exit(1);
});