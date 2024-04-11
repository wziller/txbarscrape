import puppeteer from "puppeteer-core";
import * as dotenv from "dotenv";
import { urlArray } from "./Data/URLArray.js";
import * as fs from "fs";
import moment from "moment";
import convertToCsv from "./joinArrays.js";


// URLArray is provided by selecting the 2nd page, modifying the the MaxNumber Value 10000, selecting previous, and running:
// Array.from(
//       document.querySelectorAll(
//         "#result-set > div > article > div.avatar-column > h3 > a"
//       )
//     ).map((x) => x.href);

async function run() {
  dotenv.config();
  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  const res = [];
  const failures = {};
  let browser;
  const userName = process.env.BDATA_USERNAME?.toString();
  const password = process.env.BDATA_PASSWORD?.toString();
  const host = process.env.BDATA_HOST.toString();
  const auth = `${userName}:${password}`;

  browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  let lawyerCount = 1;
  for (const importUrl of urlArray) {
    try {
      if (lawyerCount % 10 === 0) {
        browser.close();
        browser = await puppeteer.launch({
          headless: false,
          ignoreHTTPSErrors: true,
          executablePath:
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        });
      }
      if (lawyerCount % 100 === 0) {
        await delay(60000)
      }
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(3 * 60 * 1000);
      await page.goto(importUrl);

      let lawyerTotal = urlArray.length;

      console.log(`Beginning Lawyer ${lawyerCount} of ${lawyerTotal}...`);

      await page.waitForXPath('//*[@id="hcard-Lawyer-L-Name"]');

      const prefix = await page.evaluate(
        () => document.querySelector(".honorific-prefix").textContent
      );
      const givenName = await page.evaluate(() =>
        Object.values(document.querySelectorAll(".given-name")).map((name) =>
          name.textContent.trim()
        )
      );

      const additionalName = await page.evaluate(() =>
        Object.values(document.querySelectorAll(".additional-name"))
          .map((name) => name.textContent.trim())
          .filter((name) => {
            if (name != "") {
              return name;
            }
          })
      );
      const familyName = await page.evaluate(
        () => document.querySelector(".family-name").textContent
      );
      const firm = await page.evaluate(
        () => document.querySelector("h5").textContent
      )
      const suffix = await page.evaluate(
        () => document.querySelector(".honorific-suffix").textContent
      );

      // Get Barcard Number

      const barCardPara = await page.evaluate(
        () => document.querySelector("#hcard-Lawyer-L-Name > p").innerText
      );
      const barCardNum = await generateBarCard(barCardPara);

      const specialtiesPara = await page.evaluate(
        () => document.querySelector(".areas").textContent
      );
      const address = await page.evaluate(() =>
        document
          .querySelector(".address")
          .textContent.replace(/(\r\n|\n|\r|\t)/gm, "")
          .trim()
      );

      const specialties = await generateSpecialties(specialtiesPara);

      const licenseDate = await generateLicenseDate(barCardPara);

      const contacts = await page.evaluate(async () => {
        const contactObj = {};
        const linksArr = await Array.from(
          document.querySelectorAll(
            "body > section > article > div > div.contact > a"
          )
        );
        linksArr.forEach((link) => {
          let linkTitle = link.textContent;
          let linkHref = link.href;

          if (linkTitle.includes("Tel")) {
            linkTitle = "telephone";
            linkHref = linkHref.slice(5, linkHref.length);
          }
          if (linkTitle === "VISIT WEBSITE ") {
            linkTitle = "website";
          }
          contactObj[linkTitle] = linkHref;
        });
        return contactObj;
      });

      let websiteUrl = contacts.website;
      let telephone = contacts.telephone;

      const lawyerData = {
        prefix: prefix ? prefix : null,
        givenName: givenName ? givenName : null,
        additionalName: additionalName ? additionalName : null,
        familyName: familyName ? familyName : null,
        suffix: suffix ? suffix : null,
        barCardNum: barCardNum ? barCardNum : null,
        firm:
          firm === "Contact Information" ? "None Reported By Attorney" : firm,
        specialties: specialties ? specialties : null,
        licenseDate: licenseDate ? licenseDate : null,
        websiteUrl: websiteUrl ? websiteUrl : null,
        telephone: telephone ? telephone : null,
        address: address ? address : null,
        type: "Lawyer",
        barUrl: importUrl,
      };
      res.push(lawyerData);
      console.log(lawyerData);
      console.log("Success!");
      delay(5000);
      lawyerCount++;
      await page.close();
    } catch (e) {
      console.log("Scrape Failed", importUrl, e);
      failures[importUrl] = e;
      lawyerCount++;
      continue;
    }
  }

  const lawyerData = JSON.stringify(res);
  browser?.close();
  createLawyerFile(lawyerData);
  createCSVFile(lawyerData);
  createFailureReport(JSON.stringify(failures));
  return lawyerData;
}

const createLawyerFile = (lawyersObj) => {
  const date = moment().format("YYYYMMDD").toString();
  fs.writeFile(`./data/${date}-TexasBarData.json`, lawyersObj, function (err) {
    if (err) {
      console.log(err);
    }
  });
};

const createCSVFile = async (lawyersObj) => {
  const date = moment().format("YYYYMMDD").toString();
  await fs.writeFile(`./data/${date}JSONbackup.json`, lawyersObj, function (err) {
    if (err) {
      console.log(err);
    }
  });
  await convertToCsv(JSON.parse(lawyersObj));
};

const createFailureReport = (lawyersObj) => {
  const date = moment().format("YYYYMMDD").toString();
  fs.writeFile(`./data/${date}-Failures.json`, lawyersObj, function (err) {
    if (err) {
      console.log(err);
    }
  });
};
const generateLicenseDate = (barCardPara) => {
  barCardPara = barCardPara.split(": ");
  const licenseDate = barCardPara[2];
  return licenseDate;
};
const generateSpecialties = (specialtiesPara) => {
  const specialties = specialtiesPara
    .slice(24, specialtiesPara.length)
    .trim()
    .split(", ");

  return specialties;
};

const generateBarCard = async (barcardPara) => {
  console.log("barCardPara", barcardPara);

  const regex = /[0-9]{8}/;

  const barcardNum = await barcardPara.match(regex)[0];
  console.log("barcardNum", barcardNum);
  return barcardNum;
};

async function retry(page, url, retryCount) {}

run();
