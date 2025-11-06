// test-deps.js
// File for testing dependencies

import _ from "lodash";
import axios from "axios";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { app, Tray, session } from "electron";

export function demo() {
  console.log(_.chunk([1, 2, 3, 4], 2));
  return axios.get("https://api.github.com/");
}
