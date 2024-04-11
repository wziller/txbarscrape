import * as fs from "fs";
import moment from "moment";
import { parse } from "json2csv";

export default function convertToCsv(objToJoin) {
  console.log("JOIN",typeof objToJoin);

  objToJoin.forEach((lawyer) => {
    lawyer["specialties"].forEach((specialty, idx) => {
      lawyer[`specialty ${idx + 1}`] = specialty;
    });
    delete lawyer["specialties"];
    for (const field in lawyer) {
      if (lawyer[field] !== null && typeof lawyer[field] === "object") {
        lawyer[field] = lawyer[field].join(" ");
      }
    }
  });
  const date = moment().format("YYYYMMDD").toString();
  const csv = parse(objToJoin);

  fs.writeFile(`./data/${date}-TexasBexarBarData.csv`, csv, function (err) {
    if (err) {
      console.log(err);
    }
  });
}
