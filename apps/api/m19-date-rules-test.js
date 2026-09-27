import { extractYearFromText, extractDateFromText, extractPartialDateText, } from "./src/services/documentExtraction.js";
const tests = [
    "Sun Jan 18",
    "Sun Jan 18 2018",
    "Sunday January 18 2018",
    "18 Jan 18",
    "18 January 2018",
    "January 18, 2018",
    "18/01/18",
    "18/01/2018",
    "6/13/17",
    "12/25/17",
    "4/28/2019",
    "11/30/18",
    "2000",
    "2009",
    "2018",
    "2026",
    "Year: 18",
    "Year: 07",
    "Year: 26",
    "Year: 92",
    "Year: 00",
    "The number 18 appears in the document.",
];
for (const input of tests) {
    const year = extractYearFromText(input);
    const date = extractDateFromText(input);
    const extractedDateText = extractPartialDateText(input, year, date);
    console.log(`\nINPUT: ${input}`);
    console.log(`YEAR: ${year}`);
    console.log(`DOCUMENT DATE: ${date}`);
    console.log(`EXTRACTED DATE TEXT: ${extractedDateText}`);
}
//# sourceMappingURL=m19-date-rules-test.js.map