# Student Loan Scraper

A small tool to scrape your student loan information from your provider's website. 
There's no incentive to provide you anything other than a PDF, so being able to scrape and normalize your date, 
  and then process it in a spreadsheet is very helpful to calculate your payments.

## Integrations

- [x] Nelnet
- [ ] ??? 


## Instructions

Create a `.env` file with the following:

* `SPREADSHEET_ID` - your Google Sheets spreadsheet ID 
* `SPREADSHEED_RANGE` - named range of within your spreadsheet to append data
* `USERNAME` - your Nelnet username
* `PASSWORD` - your Nelnet password

Run `yarn`.

Then `node index.js`
