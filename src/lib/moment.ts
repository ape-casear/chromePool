import moment from "moment";

export const format = () => {
  return moment().format("YYYY-MM-DD HH:mm:ss");
}