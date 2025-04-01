[← See my other Open Source projects](https://robinvanbaalen.nl)

# @rvanbaalen/source-to-llm

## Description

Convert source code to a format suitable for LLM processing. This tool generates two main outputs:

* **structure.txt**: A text file representing the directory structure of your project.

* **contents.txt**: A text file containing the concatenated content of your source code files, each preceded by a file path marker.

These outputs can be used as context for Large Language Models (LLMs) to enable them to understand and work with your codebase.

##   Installation

Install the package via npm:

    npm install @rvanbaalen/source-to-llm

##   Usage

###   Basic Usage

To use the package, run it from your project's root directory:

    npx @rvanbaalen/source-to-llm

This will create `structure.txt` and `contents.txt` in the current directory.

###   Options

* `targetDir`: Specifies the directory to analyze. Defaults to the current directory.

* `outputDir`: Specifies the directory where the output files (`structure.txt` and `contents.txt`) will be written. Defaults to the current directory.

* `gitignore`: A boolean to determine if `.gitignore` rules should be used. If true, files ignored by git will be excluded from the output. Defaults to true.

* `ignores`: An array of glob patterns for files/directories to ignore in addition to `.gitignore` rules.

* `only`: An array of glob patterns for files/directories to include. Only these files will be processed.

* `includeContentsHeader`: A boolean to include the "Contents from directory" header in `contents.txt`. Defaults to true.

* `structureFilename`: The name of the file to write the structure to. Defaults to "structure.txt".

* `contentsFilename`: The name of the file to write the file contents to. Defaults to "contents.txt".

* `exportPrompt`: If true, the system prompt template used for LLMs will be exported to `prompt.txt` in the output directory. Defaults to false.

* `config`: Path to the configuration file. Defaults to `stl.config.js` in the current directory.

* `help`:  Display help message.

* `version`: Display the package version.
* `init`:  Creates a default `stl.config.js` file in the current directory.

###   Configuration File

You can configure the package using a file named `stl.config.js` in your project's root directory. You can also specify a custom path using the `--config` option. Here's an example:

    // stl.config.js
    export default {
        gitignore: true,
        ignores: ["dist/", "*.log"],
        only: ["src", "index.html"],
        includeContentsHeader: false,
        outputDir: "./output",
        structureFilename: "project_structure.txt",
        contentsFilename: "code_dump.txt",
        exportPrompt: true,
    };

###   Command Line Arguments

You can use command-line arguments to override the configuration file and specify additional options:

* `--output <directory>`: Sets the output directory.

* `--config <path>`:  Sets the path to the configuration file.

* `-h, --help`:  Displays the help message.

* `-v, --version`: Displays the package version.
* `--init`: Creates a default `stl.config.js` file in the current directory.

For example:

    npx @rvanbaalen/source-to-llm --init --config ./my-config.js --output ./my-output

This command will create a default configuration file at `./my-config.js` and output the files to the `./my-output` directory.

##   Output

The package generates the following files:

* `structure.txt`: Contains a tree-like representation of your project's directory structure. This is useful for understanding the organization of the codebase.

* `contents.txt`: Contains the concatenated content of all the text-based files in your project. Each file's content is prefixed with a comment indicating its path. This format is designed to be easily ingested by an LLM.

* `prompt.txt`: (Optional) If `exportPrompt` is set to true, this file contains the default system prompt template.

##   Development

To contribute to this project, follow these steps:

1.  Clone the repository:

        git clone [https://github.com/rvanbaalen/source-to-llm.git](https://github.com/rvanbaalen/source-to-llm.git)

2.  Install dependencies:

        cd source-to-llm
        npm install

3.  Make your changes and test them.

4.  Submit a pull request.

##   Contributing

Contributions are welcome! If you have any suggestions, improvements, or bug fixes, please [open an issue](https://github.com/rvanbaalen/source-to-llm/issues/new) or \[submit
