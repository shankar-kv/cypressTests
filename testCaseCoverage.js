const fs = require('fs');
const path = require('path');
const json2csv = require('json2csv').parse;
const { execSync } = require('child_process');
const rootDir = './cypress/e2e';
const combinedRegex = /\b(?:it|describe)\s*\(\s*["']([^{]+)["']\s*[,]/g;

let gitCommitDetails = {};

function getLatestCommitInfo(filePath) {
	try {
		// Run git log command to get the latest commit information for the given file
		const gitLogOutput = execSync(`git log -n 1 --format="%ad,%an" --date=format:'%Y-%m-%d' -- "${filePath}"`, { encoding: 'utf-8' });

		// Parse the output to get commit date and author
		const [commitDate, commitAuthor] = gitLogOutput.trim().split(',');
		gitCommitDetails.commitAuthor = commitAuthor;
		gitCommitDetails.commitDate = commitDate;

		return gitCommitDetails;
	} catch (error) {
		console.error(`Error getting commit info for ${filePath}: ${error.message}`);
		return null;
	}
}

const extractTestCases = (data, regex, folderName, fileName, results) => {
	let match;
	let fileData = {context: null};
	let currentContext = null;

	while ((match = regex.exec(data)) !== null) {
		const testName = match[1].trim();
		const testType = match[0].startsWith('describe') ? 'describe' : 'it';

		if (testType === 'describe') {
			if(fileData && fileData.context && !fileData.its)
				results.push({...fileData, its: ""});
			getLatestCommitInfo(`${fileName}`);
			fileData = { folderName: currentContext ? "" : folderName, filename: currentContext ? "" : path.basename(fileName), context: null, commitAuthor: currentContext ? "" : gitCommitDetails.commitAuthor, commitDate: currentContext ? "" : gitCommitDetails.commitDate};
			currentContext = testName;
			fileData.context = currentContext;
		} else if (testType === 'it' && currentContext) {
			if(fileData.its)
				results.push({its: testName});
			else{
				fileData.its = testName;
				results.push(fileData);
			}

		}
	}
};

const getAllFiles = (dir, results) => {
	fs.readdirSync(dir).forEach((file) => {
		const filePath = path.join(dir, file);
		const isDirectory = fs.statSync(filePath).isDirectory();

		if (isDirectory) {
			getAllFiles(filePath, results);
		} else {
			const fileContent = fs.readFileSync(filePath).toString();
			const folderName = path.relative(rootDir, dir);
			extractTestCases(fileContent, combinedRegex, folderName, filePath, results);
		}

	});
};

// Create an array to store the extracted test cases
const extractedResults = [];

// Get all files and extract test cases
getAllFiles(rootDir, extractedResults);

// Define CSV fields and transform function
const csvFields = ['folderName', 'filename', 'context', 'its', 'commitAuthor', 'commitDate'];

const csvOutput = json2csv(extractedResults, { fields: csvFields, header: true });

// Write CSV to file
fs.writeFileSync('testCaseCoverage.csv', csvOutput);
