/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
require('dotenv').config()
const puppeteer = require('puppeteer')
const _ = require('lodash')
const fs = require('fs')
const fsPromises = require('fs').promises
const readline = require('readline')
const { google } = require('googleapis')

// Google spreadsheet shit
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const TOKEN_PATH = 'token.json'

async function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  })

  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => rl.question('Enter the code from that page here: ', (code) => {
    rl.close()
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token)
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err)
        resolve(oAuth2Client)
      })
    })
  }))
}

async function authorize(credentials) {
  const { client_id, client_secret, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

  let token
  let client
  try {
    token = await fsPromises.readFile(TOKEN_PATH)
    oAuth2Client.setCredentials(JSON.parse(token))
  } catch (e) {
    client = await getNewToken(oAuth2Client)
    return client
  }
  return oAuth2Client
}

const parseTables = async (tables) => {
  const loanDetails = {}
  for (const table of tables) {
    const tbody = await table.$('tbody')
    const trs = await tbody.$$('tr')
    for (const tr of trs) {
      const header = await tr.$eval('th', (e) => _.replace(e.innerText.trim(), /:$/, ''))
      let value
      if (header === 'Last Payment Received') {
        // Remove 'view payment history' link
        value = await tr.$eval('td', (e) => e.innerText.trim())
        value = _.replace(value, '\n\nView Payment History', '')
      } else if (header === 'Disbursements') {
        // Split disbursements value into array
        value = await tr.$eval('td', (e) => e.innerText.trim())
        value = value.split('\n').map((e) => e.trim()).filter((e) => e !== '')
        value = value.join(",")
      } else {
        // Handle normally
        value = await tr.$eval('td', (e) => e.innerText.trim())
      }
      // Don't override if something already there
      if (!_.has(loanDetails, header) && !loanDetails[header] !== '') {
        loanDetails[header] = value
      } else {
        loanDetails[`${header}.2`] = value
      }
    }
  }
  return loanDetails
}

(async () => {
  let content
  let auth

  try {
    content = await fsPromises.readFile('client_id.json')
  } finally {
    auth = await authorize(JSON.parse(content))
  }

  const sheets = google.sheets({ version: 'v4', auth })

  const browser = await puppeteer.launch({
    headless: true,
  })
  const page = await browser.newPage()
  await page.goto('https://www.nelnet.com/account/login', {
    timeout: 120000,
    waitUntil: 'networkidle2',
    args: ['--no-sandbox'],
  })
  await page.type('.control-label', process.env.USERNAME)
  await Promise.all([
    page.waitForSelector('#Password', { visible: true }),
    page.click('#submit-username'),
  ]).catch((e) => {
    console.error(e)
  })

  await page.type('#Password', process.env.PASSWORD)
  await Promise.all([
    page.waitForSelector('#mainNavigation > ul > li:nth-child(2) > a'),
    page.click('#submit-password'),
  ])

  await Promise.all([
    page.waitForSelector('#area-one > div > div.primary-box > div > button'),
    page.click(
      '#mainNavigation > ul > li:nth-child(2) > a',
    ),
  ])

  await Promise.all([
    page.click('#area-one > div > div.primary-box > div > button'),
    page.waitForSelector('#group0', { visible: true }),
  ])

  const results = []
  const accounts = await page.$$('div.account-detail')
  // Iterate through each account HTML block
  for (const account of accounts) {
    // Get the horrendous tables from each block
    const tables = await account.$$('table')
    
    // Get the loan group letter
    const loanLetter = await account.$eval('.feature-info', (e) => e.innerText.trim())
    
    // Get the object scraped data from each block
    let setResults = await parseTables(tables)
    // Add object to list, each object representing a loan group
    setResults = _.merge(
      setResults,
      {
        // Retrieve the loan group letter
        'Loan Group': loanLetter,
        // Add date added as UTC human-readable string
        'Date Added': new Date().toUTCString(),
      },
    )

    results.push(setResults)
  }
  await browser.close()
  // Loan Group
  // Date Added	
  // Due Date	
  // Fees	
  // Status	
  // Interest Rate	
  // Accrued Interest:	
  // Last Payment Received	
  // Outstanding Balance	
  // Principal Balance	
  // Repayment Plan	
  // Loan Status	
  // Loan Type	
  // Interest 
  // Subsidy	
  // Original Loan Amount	
  // Capitalized Interest	
  // School Name	
  // Lender Name	
  // Convert to Repayment	
  // Disbursements
  resource = {
    values: results.map((group) => {
      return [
        group['Loan Group'],
        group['Date Added'],
        group['Due Date'],
        group['Fees'],
        group['Status'],
        group['Interest Rate'],
        group['Accrued Interest:'],
        group['Last Payment Received'],
        group['Oustanding Balance'],
        group['Principal Balance'],
        group['Repayment Plan'],
        group['Loan Status'],
        group['Loan Type'],
        group['Interest Subsidy'],
        group['Original Loan Amount'],
        group['Capitalized Interest'],
        group['School Name'],
        group['Lender Name'],
        group['Convert to Repayment'],
        group['Disbursements']
      ]
    })
  }
  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: process.env.SPREADSHEET_RANGE,
    valueInputOption: 'USER_ENTERED',
    resource,
  }).catch((e) => {
    console.error(e)
  })
  console.log(result)
})()
