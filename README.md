# Playwright-AlgoExpert-Scraper

This scraper downloads AlgoExpert coding interview questions and their test cases so you can access them offline and keep track of your solutions.

## Installation

1. **Clone the repository:**  

    ```bash
    git clone https://github.com/ThatDudeAlex/playwright-algoexpert-scraper
    ```

2. **Install dependencies:**  

    ```bash
    cd playwright-algoexpert-scraper
    npm install
    ```

## Configuration

Before running the scraper, configure it by editing the config.js file. Here's an example

```JavaScript
// config.js
module.exports = {
  downloadBasePath: '/path/to/your/download/directory',
  //... other configuration options (if any)
};
```

## Usage

1. **Configure the scraper:** Modify the `config.js` file to set your desired download path and other options.

2. **Launch a browser instance in remote debugging mode:**

    This allows the scraper to connect to your browser and avoid headless detection and authentication.

    * **macOS**
      ```bash
      /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
      ```

      Verify remote debugging is enabled by visiting http://localhost:9222/json/version in your browser.

    * **Windows:** Refer to this Stack Overflow answer for instructions.

    * **Other browsers:** Consult the official documentation for your browser on how to enable remote debugging.

3. **Log in to AlgoExpert:** Ensure you're logged in to your AlgoExpert account in the browser instance you launched.

4. **Run the scraper:** 
    ```bash
    node scraper.js
    ```

## How It Works

This scraper uses Playwright to connect to your browser instance and automate downloading questions and test cases from AlgoExpert. It's designed to be run in a non-headless mode, connecting to an existing browser instance where you are already logged in. This approach avoids the complexities of handling authentication and bot detection.

The scraper will:

1. Connect to your browser instance.

2. Navigate to the AlgoExpert questions page.

3. Organize questions by category.

4. For each question:
    * Extract the question title, description, sample input, and output.

    * Extract the test cases, including inputs and expected outputs.

    * Create a directory for the question.

    * Save the question details in a README.md file.

    * Save the test cases in a testcases.json file.
      Create subdirectories for different programming languages (e.g., Golang, Java, JavaScript, Python).

## Directory Structure

The scraper creates the following directory structure for each question:

```
your/download/path/
└── category
    └── question-name
        ├── README.md
        ├── testcases.json
        ├── Golang
        ├── Java
        ├── JavaScript
        └── Python
```

## Example Run (Logs)

```
AlgoExpert-Scraper % node scraper.js
Connected!
Success! - read urls_to_skip.txt
Loaded URLs that were already scraped
Goto: [https://www.algoexpert.io/questions](https://www.algoexpert.io/questions)

Starting Step: Getting questions by categories
** Success! **

-- Scraping Arrays Question 1 ---

Goto: [https://www.algoexpert.io/questions/two-number-sum](https://www.algoexpert.io/questions/two-number-sum)

Starting Step: Extraction of question description
-- Retrived title
-- Retrived description content
-- Retrived example input & output
** Success! **

Success! - directory already exist or it was created /your/download/path/here/Arrays/01-Two-Number-Sum

Success! - directory already exist or it was created /your/download/path/here/Arrays/01-Two-Number-Sum/Golang

Success! - directory already exist or it was created /your/download/path/here/Arrays/01-Two-Number-Sum/Java

Success! - directory already exist or it was created /your/download/path/here/Arrays/01-Two-Number-Sum/JavaScript

Success! - directory already exist or it was created /your/download/path/here/Arrays/01-Two-Number-Sum/Python

Generated question markdown content

Starting Step: Extraction of question testcases
-- Clicked "Run Code" button
-- Expanded all collapse testcase elements
** Success! **

Starting Step: File Handling
-- Markdown file saved at path /your/download/path/here/Arrays/01-Two-Number-Sum/README.md
-- JSON file saved at path /your/download/path/here/Arrays/01-Two-Number-Sum/testcases.json
-- Appended url to file urls_to_skip.txt

-- Scraping Arrays Question 2 ---

Goto: [https://www.algoexpert.io/questions/validate-subsequence](https://www.algoexpert.io/questions/validate-subsequence)

Starting Step: Extraction of question description
-- Retrived title
-- Retrived description content
-- Retrived example input & output
** Success! **

Success! - directory already exist or it was created /your/download/path/here/Arrays/02-Validate-Subsequence

Success! - directory already exist or it was created /your/download/path/here/Arrays/02-Validate-Subsequence/Golang

Success! - directory already exist or it was created /your/download/path/here/Arrays/02-Validate-Subsequence/Java

Success! - directory already exist or it was created /your/download/path/here/Arrays/02-Validate-Subsequence/JavaScript

Success! - directory already exist or it was created /your/download/path/here/Arrays/02-Validate-Subsequence/Python

Generated question markdown content

Starting Step: Extraction of question testcases
-- Clicked "Run Code" button
-- Expanded all collapse testcase elements
** Success! **

Starting Step: File Handling
-- Markdown file saved at path /your/download/path/here/Arrays/02-Validate-Subsequence/README.md
-- JSON file saved at path /your/download/path/here/Arrays/02-Validate-Subsequence/testcases.json
-- Appended url to file urls_to_skip.txt
```