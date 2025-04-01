#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ignore from "ignore";
import pkg from './package.json' with { type: 'json' };

// --- Configuration ---
const DEFAULT_STRUCTURE_FILENAME = "structure.txt";
const DEFAULT_CONTENTS_FILENAME = "contents.txt";
// Files/dirs to always ignore, even if not in .gitignore or config
const ALWAYS_IGNORE = [".git", "node_modules", DEFAULT_STRUCTURE_FILENAME, DEFAULT_CONTENTS_FILENAME];
const DEFAULT_CONFIG = `export default {
    gitignore: true,
    ignores: ["dist/", "*.log"],
    only: [],
    includeContentsHeader: false,
    outputDir: "./output",
    structureFilename: "structure.txt",
    contentsFilename: "contents.txt",
    exportPrompt: false,
};
`;
const SYSTEM_PROMPT_TEMPLATE = `You are a helpful assistant that understands project structure and file contents.

**Context:**

The following two files describe a software project:

1.  **structure.txt**: This file contains an ASCII tree representation of the project's directory structure.  It shows the names of files and directories, and their hierarchical relationships.
2.  **contents.txt**: This file contains the complete contents of the text-based files in the project.  The content of each file is preceded by a comment indicating the file's path (e.g., \`/* --- File: src/index.js --- */\`).  Binary files are not included.

**Instructions:**

* **Understand the Project:** Use \`structure.txt\` to understand the organization of the project.  Use \`contents.txt\` to understand the content of individual files.
* **File References:** Always refer to files by their full path as given in the \`contents.txt\` file (e.g., \`src/components/MyComponent.js\`).  This is crucial for clarity.
* **Complete File Contents:** When you provide the contents of a file, *always* provide the *entire* content of that file. Do not provide partial updates or diffs, unless explicitly asked by the user for a code diff.
* **Edits and Modifications:** If the user asks you to modify a file, generate the complete new content for that file.  Clearly state the file path that is being modified.
* **Directory Structure:** If you need to create new files or folders, ask the user first. Do not create new files or folders unless the user explicitly asked for this.
* **No Duplication:** Do not include the file path comment (e.g., \`/* --- File: ... --- */\`) in your response when providing file contents.
* **Respond concisely**
* **Concisely add comments to the code**
* **Use jsdoc blocks**
* **Do not explain the generated code, unless explicitly asked by the user**

**Example Interaction:**

User: "Please add a function called \`doSomething\` to \`src/utils.js\` that returns the value 1"

Assistant: "Okay, here is the new content for \`src/utils.js\`:

\`\`\`javascript
function doSomething() {
  return 1;
}

export { doSomething };
\`\`\`"

User: "Refactor the code to move the \`MyComponent\` from \`src/components/MyComponent.js\` to \`src/components/MyNewComponent.js\` and update all files using it."

Assistant: "Okay, here are the changes:

1.  Rename file \`src/components/MyComponent.js\` to \`src/components/MyNewComponent.js\`.
2.  Modify the following files to import from the new location:
    * \`src/index.js\`
    * \`src/app.js\`

Here is the new content for \`src/components/MyNewComponent.js\`:

\`\`\`javascript
import React from 'react';

const MyNewComponent = () => {
  return (
    <div>
      This is my component!
    </div>
  );
};

export default MyNewComponent;
\`\`\`

Here is the new content for \`src/index.js\`:

\`\`\`
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

\`\`\`

Here is the new content for \`src/app.js\`:

\`\`\`
import React from 'react';
import MyNewComponent from './components/MyNewComponent';

function App() {
  return (
    <div>
      <MyNewComponent />
      <h1>Hello, world!</h1>
    </div>
  );
}

export default App;
\`\`\`"
`;

// --- Helper Functions ---

/**
 * Loads and parses .gitignore rules from the target directory.
 * @param {string} targetDir - The absolute path to the target directory.
 * @param {boolean} useGitignore - Whether to use .gitignore.
 * @returns {Promise<import('ignore').Ignore>} - An ignore instance.
 */
async function loadGitignore(targetDir, useGitignore) {
  const ig = ignore().add(ALWAYS_IGNORE); // Start with always ignored patterns
  if (useGitignore) {
    const gitignorePath = path.join(targetDir, ".gitignore");
    try {
      const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
      ig.add(gitignoreContent);
      console.log(`Loaded rules from ${gitignorePath}`);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(".gitignore not found, using default ignore rules.");
      } else {
        console.warn(`Warning: Could not read .gitignore: ${error.message}`);
      }
    }
  } else {
    console.log(".gitignore processing skipped as per configuration.");
  }

  return ig;
}

/**
 * Recursively traverses the directory, building structure and concatenates files.
 * @param {string} currentDir - Absolute path of the directory currently being processed.
 * @param {string} rootDir - Absolute path of the initial target directory.
 * @param {import('ignore').Ignore} ig - The ignore instance.
 * @param {string} prefix - The prefix string for ASCII tree structure.
 * @param {object} output - Object to store results ({ structure: string, contents: string }).
 * @param {string[]} only - Optional whitelist for files/folders.
 * @param {boolean} includeContentsHeader - Whether to include the contents header.
 */
async function traverseDirectory(currentDir, rootDir, ig, prefix, output, only, includeContentsHeader) {
  let entries;
  try {
    // Read directory entries, getting file types directly
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch (error) {
    console.warn(`Warning: Could not read directory ${currentDir}: ${error.message}`);

    return; // Skip directories we can't read
  }

  // Filter out ignored entries *before* processing
  const validEntries = entries.filter((entry) => {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);
    const checkPath = entry.isDirectory() ? `${relativePath}/` : relativePath;

    // Apply whitelist if defined
    if (only && only.length > 0) {
      const matchesOnly = only.some((pattern) => {
        // Convert glob pattern to regex
        const regex = new RegExp(`^${pattern.replace(/\*\*/g, "(.+)").replace(/\*/g, "([^/]+)")}$`);

        return regex.test(checkPath);
      });
      if (!matchesOnly) {
        return false;
      }
    }

    return !ig.ignores(checkPath);
  });

  for (let i = 0; i < validEntries.length; i++) {
    const entry = validEntries[i];
    const absolutePath = path.join(currentDir, entry.name);
    const isLast = i === validEntries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const newPrefix = prefix + (isLast ? "    " : "│   ");

    // --- Build Structure ---
    output.structure += `${prefix}${connector}${entry.name}\n`;

    if (entry.isDirectory()) {
      // Recurse into subdirectory
      await traverseDirectory(absolutePath, rootDir, ig, newPrefix, output, only, includeContentsHeader);
    } else if (entry.isFile()) {
      // --- Build Contents ---
      const relativePath = path.relative(rootDir, absolutePath);
      try {
        // Attempt to read as UTF-8. If it fails, likely binary, so skip.
        const content = await fs.readFile(absolutePath, "utf-8");
        if (includeContentsHeader) {
          output.contents += `\n/* --- File: ${relativePath} --- */\n\n`;
        }

        output.contents += content;
        output.contents += "\n";
      } catch (readError) {
        if (readError.message.includes("invalid") || readError.message.includes("buffer")) {
          console.log(`Skipping likely binary file: ${relativePath}`);
        } else {
          console.warn(`Warning: Could not read file ${relativePath}: ${readError.message}`);
        }
      }
    }
  }
}

// --- Main Execution ---

async function main() {
  // 0. Handle --help and --version flags
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (process.argv.includes("--version") || process.argv.includes("-v")) {
    console.log(pkg.version);
    process.exit(0);
  }

  // 0.1 Handle --init
  if (process.argv.includes("--init")) {
    try {
      await fs.writeFile("stl.config.js", DEFAULT_CONFIG);
      console.log("Default stl.config.js created.");
      process.exit(0);
    } catch (error) {
      console.error(`Error creating config file: ${error.message}`);
      process.exit(1);
    }
  }

  // 1. Determine Target Directory
  const inputArg = process.argv[2]; // Get the first argument after script name
  const targetDir = inputArg ? path.resolve(process.cwd(), inputArg) : process.cwd();

  console.log(`Analyzing directory: ${targetDir}`);

  try {
    const stats = await fs.stat(targetDir);
    if (!stats.isDirectory()) {
      throw new Error(`"${targetDir}" is not a directory.`);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`Error: Directory not found: ${targetDir}`);
    } else {
      console.error(`Error accessing directory: ${error.message}`);
    }

    process.exit(1);
  }

  // 2. Load Config
  let config = {
    gitignore: true,
    ignores: [],
    only: [],
    includeContentsHeader: true,
    outputDir: process.cwd(), // Default output directory
    structureFilename: DEFAULT_STRUCTURE_FILENAME,
    contentsFilename: DEFAULT_CONTENTS_FILENAME,
    exportPrompt: false, // Default value for exportPrompt
  };
  // 2.1. Config file from --config
  const configArgIndex = process.argv.indexOf("--config");
  if (configArgIndex > -1 && configArgIndex + 1 < process.argv.length) {
    const configPath = path.resolve(process.cwd(), process.argv[configArgIndex + 1]);
    try {
      const configURL = new URL(`file://${configPath}`);
      const configFile = await import(configURL);
      config = { ...config, ...configFile.default };
      console.log(`Loaded configuration from: ${configPath}`);
    } catch (configError) {
      console.error(`Error loading configuration file: ${configError.message}`);
      process.exit(1); // Exit on config error
    }
  } else {
    // 2.2.  Default config file
    try {
      const configPath = path.join(process.cwd(), "stl.config.js");
      const configURL = new URL(`file://${configPath}`);
      const configFile = await import(configURL);
      config = { ...config, ...configFile.default };
      console.log(`Loaded configuration from default path: ${configPath}`);
    } catch (configError) {
      if (configError.code === "ERR_MODULE_NOT_FOUND") {
        console.log("stl.config.js not found, using default configuration.");
      } else {
        console.warn(`Warning: Could not load stl.config.js: ${configError.message}`);
      }
    }
  }

  // 3. Process command line arguments
  const outputArgIndex = process.argv.indexOf("--output");
  if (outputArgIndex > -1 && outputArgIndex + 1 < process.argv.length) {
    config.outputDir = path.resolve(process.cwd(), process.argv[outputArgIndex + 1]);
    console.log(`Output directory set to: ${config.outputDir} from command line.`);
  } else if (config.outputDir) {
    console.log(`Output directory set to: ${config.outputDir} from config.`);
  }

  // 4. Ensure output directory exists
  try {
    await fs.mkdir(config.outputDir, { recursive: true }); // Create directory if it doesn't exist
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    process.exit(1);
  }

  // 5. Optionally export prompt
  if (config.exportPrompt) {
    const promptOutputPath = path.join(config.outputDir, "prompt.txt");
    try {
      await fs.writeFile(promptOutputPath, SYSTEM_PROMPT_TEMPLATE);
      console.log(`Successfully wrote prompt to ${promptOutputPath}`);
    } catch (error) {
      console.error(`Error writing prompt file: ${error.message}`);
      // Don't exit, continue with other operations
    }
  }

  // 6. Load Ignore Rules
  const ig = await loadGitignore(targetDir, config.gitignore);
  ig.add(config.ignores); // Add any extra ignores from config

  // 7. Initialize Output
  const output = {
    structure: `${path.basename(targetDir)}\n`, // Start structure with root dir name
    contents: config.includeContentsHeader ? `/* --- Contents from directory: ${targetDir} --- */\n` : "",
  };

  // 8. Traverse and Build
  console.log("Starting directory traversal...");
  await traverseDirectory(targetDir, targetDir, ig, "", output, config.only, config.includeContentsHeader); // Start with empty prefix

  // 9. Write Output Files
  const structureOutputPath = path.join(config.outputDir, config.structureFilename || DEFAULT_STRUCTURE_FILENAME);
  const contentsOutputPath = path.join(config.outputDir, config.contentsFilename || DEFAULT_CONTENTS_FILENAME);

  try {
    await fs.writeFile(structureOutputPath, output.structure);
    console.log(`Successfully wrote structure to ${structureOutputPath}`);

    await fs.writeFile(contentsOutputPath, output.contents);
    console.log(`Successfully wrote contents to ${contentsOutputPath}`);
  } catch (error) {
    console.error(`Error writing output files: ${error.message}`);
    process.exit(1);
  }

  console.log("\nAnalysis complete.");
}

function printHelp() {
  console.log(`Usage: source-to-llm [targetDir] [options]

Options:
  -h, --help          Show this help message and exit.
  -v, --version       Show the package's version number and exit.
  --config <path>   Path to the configuration file (stl.config.js).
  --output <dir>    Path to the output directory.
  --init            Creates a default stl.config.js file in the current directory.
`);
}

// Run the main function and catch any top-level errors
main().catch((err) => {
  console.error("\nAn unexpected error occurred:", err);
  process.exit(1);
});
