const { chromium } = require('playwright');
const fs = require('fs').promises;;
const path = require('path');
const configs = require('./config');
const selectors = require('./selectors');

// Question categories in AlgoExpert
const CATEGORIES = [
  "Arrays",
  "Binary Search Trees",
  "Binary Trees",
  "Dynamic Programming",
  "Famous Algorithms",
  "Graphs",
  "Greedy Algorithms",
  "Heaps",
  "Linked Lists",
  "Recursion",
  "Searching",
  "Sorting",
  "Stacks",
  "Strings",
  "Tries"
];

// Languages of my solutions
const LANGUAGES = [
  'Golang',
  'Java',
  'JavaScript',
  'Python'
];

const BASE_URL  = 'https://www.algoexpert.io';
const START_URL = 'https://www.algoexpert.io/questions';

/**
 * Manages browser connections
 * @typedef {Object} BrowserManager
 * @property {import('playwright').Browser} browser
 * @property {import('playwright').BrowserContext} context
 * @property {import('playwright').Page} page
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Connects to an already existing browser over cdp on port 9222
   * @returns {Promise<import('playwright').Page>} new page on the browser
   */
  async connectToExistingChrome() {
    // To open chrome with remote port, run this command on the terminal:
    // /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
    // https://stackoverflow.com/questions/71362982/is-there-a-way-to-connect-to-my-existing-browser-session-using-playwright
    this.browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    this.context = this.browser.contexts()[0];
    this.page = await this.context.newPage(); 

    console.log("Connected!");
    return this.page;
  }

  /**
   * Terminates the browser connection
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      console.log('Succesfully Terminated!')
    }
  }
}

/**
 * Handles page interactions such as navigation, and element interactions
 * @typedef {Object} PageHandler
 * @property {import('playwright').Page} page
 */
class PageHandler {
  constructor(page) {
    this.page = page;
  }

  /**
   * Goes to the given `url`
   * @param {string} url 
   */
  async goToUrl(url) {
    console.log(`Goto: ${url}\n`);
    await this.page.goto(url, { waitUntil: 'networkidle' }); // Realistic waiting
    await this.page.waitForTimeout(5000);
  }

  /**
   * Returns the text contents of the element found with `selectorOrLocator`
   * @param {string|import('playwright').Locator} selectorOrLocator - Either a CSS selector or a Locator. 
   * @returns {string} the element text contents
   */
  async getElementText(selectorOrLocator) {
     try {
      if (typeof selectorOrLocator === 'string') {
        await this.page.waitForSelector(selectorOrLocator, {timeout: 15000});
        return await this.page.locator(selectorOrLocator).textContent();
      }
        // return await element.textContent();
      return await selectorOrLocator.textContent();
     } catch (error) {
         console.error(`Error finding element with selector ${selectorOrLocator}: ${error}`);
         return null;
     }
  }

  /**
   * Returns the href of `element`
   * @param {import('playwright').Locator | import('playwright').ElementHandle} element
   * @returns {Promise<string>} The element href value
   */
  async getElementHref(element) { // New method to get href of a single element
    return await element.getAttribute('href');
  }

  /**
   * Clicks the element given in `selectorOrLocator` and waits before next action
   * @param {string|import('playwright').Locator} selectorOrLocator - Either a CSS selector or a Locator. 
   * @param {number} [waitMin=5000] - The minimum waiting time in milliseconds.
   * @param {number} [waitMax=12000] - The maximum waiting time in milliseconds.
   */
  async clickAndWait(selectorOrLocator, waitMin = 5000, waitMax = 12000) {
    const randomWait = Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;

    if (typeof selectorOrLocator === 'string') {
      await this.page.locator(selectorOrLocator).click();
    } else {
      await selectorOrLocator.click();
    }

    await this.page.waitForTimeout(randomWait);
  }

  /**
   * Clicks the first element with the given text, and waits before the next action
   * @param {string} selector - CSS selector for element
   * @param {string} elementText - Text content the element should have
   * @param {number} [waitMin=5000] - The minimum waiting time in milliseconds.
   * @param {number} [waitMax=12000] - The maximum waiting time in milliseconds.
   */
  async clickElemenWithText(selector, elementText, waitMin = 5000, waitMax = 12000) {
    const randomWait = Math.floor(Math.random() * (waitMax - waitMin + 1)) + waitMin;
    await this.page.locator(selector, { hasText: elementText }).click();
    await this.page.waitForTimeout(randomWait);
  }

  /**
   * Gets all elements elements with the given selector
   * @param {string} selector - CSS selector for elements 
   * @returns {Promise<import('playwright').ElementHandle<HTMLElement>>} A promise that resolves to an array of ElementHandle objects.
   */
  async getElements(selector) {
    const elements = await this.page.locator(selector).all(); // Get all matching elements
    for (const element of elements) {
      // Wait until each element is attached to the DOM
      await element.waitFor({ state: 'attached', timeout: 15000 });
    }
    return elements; // All elements are attached
  }

}

/**
 * Handles the extraction & transformation of data 
 * @typedef {Object} DataExtractor
 */
class DataExtractor {

  /**
   * @typedef {Object} CodingQuestion
   * @property {string} title - The title of the coding question.
   * @property {string} description - The description of the question.
   * @property {string} exampleInput - Example input for the question.
   * @property {string} exampleOutput - Example output for the question.
   */

  /**
   * @param {PageHandler} pageHandler - The pageHandler component
   * @returns {Promise<CodingQuestion>} A promise that resolves to a CodingQuestion object.
   */
  async extractQuestionData(pageHandler) {
    console.log('Starting Step: Extraction of question description');

    const title = await pageHandler.getElementText(selectors.questionTitle).then(text => text.trim());
    console.log('-- Retrived title');

    // All description paragraphs
    const paragraphsTextContent = await this.extractTextFromElements(pageHandler, selectors.questionParagraph);
    const description = paragraphsTextContent.map(p => this.removeNewlineSpaces(p)).join('\n\n');
    console.log('-- Retrived description content');

    // Example input & output
    const preTagsTexContent = await this.extractTextFromElements(pageHandler, selectors.questionExample);
    const exampleInput  = preTagsTexContent[0].trim();
    const exampleOutput = preTagsTexContent[1].trim();
    console.log('-- Retrived example input & output');

    const codingQuestion = {
      title, description, exampleInput, exampleOutput
    };

    console.log('** Success! **\n');
    return codingQuestion;
  }

  /**
   * @typedef {Object} TestCaseInputs
   * @property {any}... - The structure of the inputs will vary depending on the test cases.
   */

  /**
   * @typedef {Object} TestCase
   * @property {TestCaseInputs} inputs - The inputs for the test case.
   * @property {string} expected - The expected output for the test case.
   * @property {string} name - The name of the test case.
   */

  /**
   * Extracts the testcases of the coding question as an array of json objects
   * @param {PageHandler} pageHandler - The pageHandler component
   * @returns {Promise<Array<TestCase>>} A promise that resolves to an array of TestCase objects.
   */
  async extractTestCases(pageHandler) {
    console.log('Starting Step: Extraction of question testcases');

    await pageHandler.clickElemenWithText(selectors.runButton, selectors.runButtonTxt, 10000, 13000);
    console.log('-- Clicked "Run Code" button');

    const testcases = [];
    const allCollapsedTestcaseEle = await pageHandler.getElements(selectors.collapseTestcase);

    for (const element of allCollapsedTestcaseEle) {
      await pageHandler.clickAndWait(element, 4000, 7000);
    }
    console.log('-- Expanded all collapse testcase elements');

    const allTestcaseEle = await pageHandler.getElements(selectors.testcaseData);

    let testNum = 1;
    let expectIdx = 0;
    let inputIdx = 2;

    while (inputIdx < allTestcaseEle.length) {
       // inputTxt is already a string represention of a json object
      const expectedTxt = await allTestcaseEle[expectIdx].locator(selectors.testcaseDataNested).textContent();
      const inputTxt    = await allTestcaseEle[inputIdx].locator(selectors.testcaseDataNested).textContent();
      let jsonObject = {};

      try {
        jsonObject['inputs'] = JSON.parse(inputTxt);

        // if expectedTxt begins with a letter, save it as a string
        // else json to avoid the quotes
        if (/^[a-zA-Z]/.test(expectedTxt)) {
          jsonObject['expected'] = expectedTxt; 
        } else {
          jsonObject['expected'] = JSON.parse(expectedTxt);
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
      jsonObject['name'] = `Test Case ${testNum++}`;

      testcases.push(jsonObject);
      expectIdx = inputIdx  + 1;
      inputIdx  = expectIdx + 2;
    }
    
    console.log('** Success! **\n');
    return testcases;
  }

  /**
   * Extracts the text contents of all elements with the given selector
   * @param {PageHandler} pageHandler - The pageHandler component
   * @param {string} selector - CSS selector for elements 
   * @returns {Promise<Array<string>>} Array that contains the text content of each element
   */
  async extractTextFromElements(pageHandler, selector) {
    const elements = await pageHandler.getElements(selector);
    const textContentArray = [];

    for (const element of elements) {
      const text = await element.textContent(); // Get text content of each element
      textContentArray.push(text);
    }
    
    return textContentArray;
  }

  /**
   * Gets all questions by category
   * @param {PageHandler} pageHandler - The pageHandler component
   * @param {Array<string>} categories - Array of question categories in AlgoExpert
   * @returns {Promise<Map<string, Array<string>>>} Map containing all question URLs by categories. `key = category`, `value = array of urls`
   */
  async getQuestionsByCategory(pageHandler, categories, baseUrl) {
    console.log('Starting Step: Getting questions by categories');
    const questionsByCategory = new Map();

    for (const category of categories) {
      const questions = await pageHandler.getElements(selectors.questionByCategory(category));
      const questionQueue = []; // array will be used as a queue

      for (const question of questions) {
        const href = await pageHandler.getElementHref(question);
        questionQueue.push(`${baseUrl}${href}`);
      }
      questionsByCategory.set(category, questionQueue);
    }    
    console.log('** Success! **\n');
    return questionsByCategory;
  }
  

  /**
   * Creates a markdown file representation of the coding question
   * @param {CodingQuestion} codingQuestion 
   * @returns {string} markdown represention of the coding question description
   */
  generateQuestionMarkdown(codingQuestion) {
    // Construct markdown text
    const markdown = `
## ${codingQuestion.title}

${codingQuestion.description}

### Sample Input
\`\`\`
${codingQuestion.exampleInput}
\`\`\`

### Sample Output
\`\`\`
${codingQuestion.exampleOutput}
\`\`\`
`;
    console.log('Generated question markdown content\n');
    return markdown;
  }

  /**
   * Removes spaces after newlines and trims the text
   * @param {string} text 
   * @returns {string} input text with spaces after newlines removed and trimmed
   */
  removeNewlineSpaces(text) {
    return text.replace(/\n\s+/g, '\n').trim();  // 
  }

}

/**
 * Manages the handling of files and directories 
 * @typedef {Object} FileManager
 */
class FileManager {
    async createDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Success! - directory already exist or it was created ${dirPath}\n`);
        } catch (error) {
            console.error(`Error creating directory ${dirPath}: ${error}`);
            throw error;
        }
    }

    /**
     * Stores a markdown with the given text content in the file path
     * @param {string} filePath - The path to store the markdown file in
     * @param {string} content  - The markdown file text content 
     */
    async saveMarkdown(filePath, content) {
        try {
            await fs.writeFile(filePath, content);
            console.log(`-- Markdown file saved at path ${filePath}`);
        } catch (error) {
            console.error(`Error saving markdown file ${filePath}: ${error}`);
            throw error;
        }
    }

    /**
     * Saves the array of json testcase data as a json file in the given path
     * @param {string} filePath - The path to store the markdown file in
     * @param {Array<TestCase>} data - array of json data for each testcase
     */
    async saveJson(filePath, data) {
      try {
        const prettyJson = JSON.stringify(data, null, 2); // Prettified JSON
        // TODO: decided whether to try and make testcase.json file not have a new line
        //       line between every array element or remove the line below
        // const formattedJsonString = jsonString.replace(/\[\n\s*(\[.*?\]),\n\s*(\[.*?\]),\n\s*(\[.*?\])\n\s*\]/g, '[[ $1 ], [ $2 ], [ $3 ]]');

        await fs.writeFile(filePath, prettyJson);
        console.log(`-- JSON file saved at path ${filePath}`);
      } catch (error) {
        console.error(`Error saving JSON file ${filePath}: ${error}`);
        throw error;
      }
    }

    async appendToFile(filePath, content) {
      try {
          await fs.appendFile(filePath, content + '\n');
          console.log(`-- Appended url to file ${filePath}\n`);
      } catch (error) {
          console.error(`Error appending to file ${filePath}: ${error}`);
          throw error;
      }
    }

    /**
     * Reads the urls_to_skip file 
     */
    async readUrlsToSkipFile() {
      try {
        const data = await fs.readFile('urls_to_skip.txt', 'utf8'); 
        console.log(`Success! - read urls_to_skip.txt`);
        return data;
      } catch (error) {
          console.warn(`Error reading urls_to_skip.txt file: ${error}`);
          throw error;
      }
    }

    /**
     * Creates a new urls_to_skip file 
     */
    async createUrlsToSkipFile() {
      try {
        await fs.writeFile('urls_to_skip.txt', '');
        console.log(`Success! - created urls_to_skip.txt`);
      } catch (error) {
          console.error(`Error creating urls_to_skip.txt file: ${error}`);
          throw error;
      }
    }
}

/**
 * Primary class that runs the AlgoExpert scraper
 * @typedef {Object} Scraper
 * @property {BrowserManager} browserManager
 * @property {PageHandler} pageHandler
 * @property {DataExtractor} dataExtractor
 * @property {FileManager} fileManager
 * @property {Array<string>} urlQueue - 
 * @property {Set<string>} scrapedUrls - 
 */
class Scraper {
  constructor() {
    this.browserManager = new BrowserManager();
    this.pageHandler = null; // Will be initialized after browser connection
    this.dataExtractor = new DataExtractor();
    this.fileManager = new FileManager();
    this.scrapedUrls = null; // Set of URLs to skip while scrapping. Will be initialized after browser connection
    this.baseUrl = BASE_URL;
    this.startUrl = START_URL;
    this.categories = CATEGORIES;
  }

  /**
   * Runs the AlgoExpert scraper and orchestrates actions
   */
  async run() {
    // Init pageHandler
    const page = await this.browserManager.connectToExistingChrome();
    this.pageHandler = new PageHandler(page)
    
    // Init scrapedUrls url set for efficient O(1) lookup
    await this.initializeScrapedUrls();
    console.log('Loaded URLs that were already scraped');

    // Start at the questions URL
    await this.pageHandler.goToUrl(this.startUrl);

    const questionsByCategory = await this.dataExtractor.getQuestionsByCategory(
      this.pageHandler, this.categories, this.baseUrl);
    
    for (const category of questionsByCategory.keys()) {
      const questionQueue = questionsByCategory.get(category);


      let questionNum = 1;
      while (questionQueue.length > 0) {
        console.log(`-- Scraping ${category} Question ${questionNum} ---\n`);
        const url = questionQueue.shift();

        if (this.scrapedUrls.has(url)){
          console.log(`-- Skipping, question has already been scraped \n`);
          questionNum++;
          continue; // Skip if already scraped
        } 
  
        try {
            await this.pageHandler.goToUrl(url);

            const questionData = await this.dataExtractor.extractQuestionData(this.pageHandler);

            if (!questionData.title || !questionData.description) {
              console.warn(`Could not extract title or description from ${url}. Skipping.\n`);
              questionNum++;
              continue;
            }
  
            let numPrefix = (questionNum > 9) ? `${questionNum}-` : `0${questionNum}-`;

            const dirName = numPrefix + questionData.title.replace(/\s+/g, '-');
            const dirPath = path.join(configs.downloadBasePath, category, dirName); // base directory

            const markdownPath = path.join(dirPath, 'README.md');
            const jsonPath = path.join(dirPath, 'testcases.json');
  
            // Create question directory if not existing
            await this.fileManager.createDirectory(dirPath);

            // Create the coding languages subdirectories for the question
            for (const language of LANGUAGES) {
              const languageDirectory = path.join(dirPath, language);
              await this.fileManager.createDirectory(languageDirectory);
            }
  
            // Construct markdown content
            const markdownContent = this.dataExtractor.generateQuestionMarkdown(questionData);

            // Get testcase data
            const testcases = await this.dataExtractor.extractTestCases(this.pageHandler);

            console.log('Starting Step: File Handling');
            await this.fileManager.saveMarkdown(markdownPath, markdownContent);
            await this.fileManager.saveJson(jsonPath, testcases);
            await this.fileManager.appendToFile('urls_to_skip.txt', url); // Add to scraped URLs

            this.scrapedUrls.add(url);
            questionNum++;
        } catch (error) {
            console.error(`Error processing URL ${url}: ${error}`);
            console.log('Skipping and moving to next URL');
            questionNum++;
        }
      }
    }

    await this.browserManager.closeBrowser();
  }

  /**
   * Initializes the scrappedUrls set
   * @returns {Promise<Set<string>>} Set containing the URLs of pages already scrapped
   */
  async initializeScrapedUrls() {
    try {
      const data = await this.fileManager.readUrlsToSkipFile();
      // file is empty
      if (data == "") {
        this.scrapedUrls = new Set();
      } else {
        this.scrapedUrls = new Set(data.split('\n').map(url => url.trim()));
      }
    } catch (err) {
      if (err.code === 'ENOENT') { // Handle file not by creating the file
        console.warn('urls_to_skip.txt not found. Creating new file.');
        await this.fileManager.createUrlsToSkipFile();
        this.scrapedUrls = new Set();
      } else {
        console.error('Error reading urls_to_skip.txt:', err);
        throw err; // Re-throw the error if it's a different error
      }
    }
  }
}

const scraper = new Scraper();
scraper.run();