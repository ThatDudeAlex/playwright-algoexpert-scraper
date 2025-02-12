const { chromium } = require('playwright');
const fs = require('fs').promises;;
const path = require('path');

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

    console.log("Connected!")
    return this.page;
  }

  /**
   * Terminates the browser connection
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
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
    await this.page.goto(url, { waitUntil: 'networkidle' }); // Realistic waiting
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
        // TODO: remove if no problems encountered with page.locator() below
        // const element = await this.page.$(selectorOrLocator);
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
   * @returns {string} The element href value
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
    return await this.page.locator(selector).all();
  }

}

/**
 * Handles the extraction & transformation of data 
 * @typedef {Object} DataExtractor
 */
class DataExtractor {

  /**
   * @typedef {Object} CodingChallenge
   * @property {string} title - The title of the coding challenge.
   * @property {string} description - The description of the challenge.
   * @property {string} exampleInput - Example input for the challenge.
   * @property {string} exampleOutput - Example output for the challenge.
   */

  /**
   * @param {PageHandler} pageHandler - The pageHandler component
   * @returns {Promise<CodingChallenge>} A promise that resolves to a CodingChallenge object.
   */
  async extractChallengeData(pageHandler) {
    const title = await pageHandler.getElementText('div h2').then(text => text.trim());

    // All description paragraphs
    const paragraphsTextContent = await this.extractTextFromElements(pageHandler, '.ae-workspace-dark p');
    const description = paragraphsTextContent.map(p => this.removeNewlineSpaces(p)).join('\n\n');;

    // Example input & output
    const preTagsTexContent = await this.extractTextFromElements(pageHandler, '.ae-workspace-dark pre');
    const exampleInput  = preTagsTexContent[0].trim();
    const exampleOutput = preTagsTexContent[1].trim();

    const codingChallenge = {
      title, description, exampleInput, exampleOutput
    };

    return codingChallenge;
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
   * Extracts the testcases of the coding challenge as an array of json objects
   * @param {PageHandler} pageHandler - The pageHandler component
   * @returns {Promise<Array<TestCase>>} A promise that resolves to an array of TestCase objects.
   */
  async extractTestCases(pageHandler) {
    await pageHandler.clickElemenWithText('button', 'Run Code', 10000, 13000)

    const testcases = [];
    const allCollapsedTestcaseEle = await pageHandler.getElements('.Gvne7CKrNUC1MWWcgX0h .EXdCvTD_bubcEGmmHOFu');

    for (const element of allCollapsedTestcaseEle) {
      await pageHandler.clickAndWait(element, 4000, 7000);
    }

    const allTestcaseEle = await pageHandler.getElements('.f7nTfdupWXhhK1Frxcbv .aR1l5rhU3UqdVORse042');

    let testNum = 1;
    let expectIdx = 0;
    let inputIdx = 2;

    while (inputIdx < allTestcaseEle.length) {
       // inputTxt is already a string represention of a json object
      const expectedTxt = await allTestcaseEle[expectIdx].locator('.ae-workspace-dark').textContent();
      const inputTxt    = await allTestcaseEle[inputIdx].locator('.ae-workspace-dark').textContent();
      let jsonObject = {};

      try {
        jsonObject['inputs'] = JSON.parse(inputTxt);
        jsonObject['expected'] = JSON.parse(expectedTxt);
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }

      jsonObject['name'] = `Test Case ${testNum++}`;

      testcases.push(jsonObject);
      expectIdx = inputIdx  + 1;
      inputIdx  = expectIdx + 2;
    }

    return testcases;
  }

  /**
   * Extracts the text contents of all elements with the given selector
   * @param {PageHandler} pageHandler - The pageHandler component
   * @param {string} selector - CSS selector for elements 
   * @returns {Array<string>} Array that contains the text content of each element
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
   * Creates a markdown file representation of the coding challenge
   * @param {CodingChallenge} codingChallenge 
   * @returns {string} markdown represention of the coding challenge description
   */
  generateChallengeMarkdown(codingChallenge) {
    // Construct markdown text
    const markdown = `
## ${codingChallenge.title}

${codingChallenge.description}

### Sample Input
\`\`\`
${codingChallenge.exampleInput}
\`\`\`

### Sample Output
\`\`\`
${codingChallenge.exampleOutput}
\`\`\`
`;
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
        } catch (error) {
            console.error(`Error creating directory ${dirPath}: ${error}`);
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
        } catch (error) {
            console.error(`Error saving markdown file ${filePath}: ${error}`);
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

        console.log(prettyJson);
        await fs.writeFile(filePath, prettyJson);
      } catch (error) {
        console.error(`Error saving JSON file ${filePath}: ${error}`);
      }
    }

    async appendToFile(filePath, content) {
      try {
          await fs.appendFile(filePath, content + '\n');
      } catch (error) {
          console.error(`Error appending to file ${filePath}: ${error}`);
      }
    }

    /**
     * Reads the urls_to_skip file 
     */
    async readUrlsToSkipFile() {
      try {
        const data = await fs.readFile('urls_to_skip.txt', 'utf8'); 
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
  constructor(baseUrl, startUrl, categories) {
    this.browserManager = new BrowserManager();
    this.pageHandler = null; // Will be initialized after browser connection
    this.dataExtractor = new DataExtractor();
    this.fileManager = new FileManager();
    this.urlQueue = []; // Queue of URLs to scrape
    this.scrapedUrls = null; // Set of URLs to skip while scrapping. Will be initialized after browser connection
    this.baseUrl = baseUrl;
    this.startUrl = startUrl;
    this.categories = categories;
  }

  /**
   * Runs the AlgoExpert scraper and orchestrates actions
   */
  async run() {
    // Init pageHandler
    const page = await this.browserManager.connectToExistingChrome();
    this.pageHandler = new PageHandler(page)
    
    // Init scrapedUrls url set for efficient O(1) lookup
    this.scrapedUrls = await this.initializeScrapedUrls();

    await this.browserManager.closeBrowser();
  }

  /**
   * Initializes the scrappedUrls set
   * @returns {Promise<Set<string>>} Set containing the URLs of pages already scrapped
   */
  async initializeScrapedUrls() {
    try {
      const data = await this.fileManager.readUrlsToSkipFile();
      this.scrapedUrls = new Set(data.split('\n').map(url => url.trim()));
    } catch (err) {
      if (err.code === 'ENOENT') { // Handle file not by creating the file
        console.warn('urls_to_skip.txt not found. Creating new file.');
        await this.fileManager.createUrlsToSkipFile();
        return new Set();
      } else {
        console.error('Error reading urls_to_skip.txt:', err);
        throw err; // Re-throw the error if it's not a "file not found" error
      }
    }
  }
}

const baseUrl  = 'https://www.algoexpert.io';
const startUrl = 'https://www.algoexpert.io/questions';

// TODO: remove after texting
// const startUrl = 'https://www.algoexpert.io/questions/three-number-sum';

// Question categories in AlgoExpert
const categories = [
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
const scraper = new Scraper(baseUrl, startUrl, categories);
scraper.run();