/* import * as moduleAlias from "module-alias";
moduleAlias.addAlias('@lib', '../lib/'); */
import net from "net";
import * as momentU from "./lib/moment";
import moment from "moment";
import psTree from "ps-tree";
import { ChildProcess, exec, execSync, spawn } from "child_process";
import { info, warn } from "./lib/log";
import request from "request";
import os from "os";
import http from "http";

const config = require("../config.json");

class Chrome{
  birthTime?: string;
  socket?: net.Socket;
  path?: string;
  execute?: ChildProcess;
  startTime: string="2000-01-01 00:00:00";
  isClosed: boolean = true;
  shouldClose: boolean = false;
  port: number;
  pid?: number;
  constructor (port: number) {
    this.port = port;
  }
}

const chromes: Chrome[] = [];
const chromesShouldBeClose: Chrome[] = [];
const timeout = (ms: number) => new Promise(res => setTimeout(res, ms));
function launch(){
  const checkPool = async () => {
    chromes.forEach(chrome => {
      if (chrome.shouldClose === true) {
        chromesShouldBeClose.push(chrome);
      }
      if (moment(chrome.birthTime).isBefore(moment().subtract(8, "seconds"))) {
        chromesShouldBeClose.push(chrome);
      }
    });
  }
  const allowcateChrome = () => {
    let chrome: Chrome | undefined =  chromes.find((chrome: Chrome) => {
      return !chrome.isClosed && !chrome.shouldClose && chrome.path !== undefined;
    })
    if (chrome ) {
      return chrome.path ;
    } else {
      return false;
    }
  }
  const runChrome = async () => {
    try {
      const preChrome = chromes.filter (chrome => {
        return chrome.isClosed === true;
      })
      for (let chrome of preChrome) {
          info("[start a chrome with port:" + chrome.port + "]");
          // let cmd = "'C:\\Users\\ape-caesar\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe --no-sandbox";
          let cmd = `D:\\chrome\\Google\\Chrome\\Application\\chrome.exe --no-sandbox`
          cmd += ` --remote-debugging-port=${chrome.port}`;
          cmd += ` --headless`;
          cmd += ``;
          console.log(cmd);
          chrome.execute =  exec(cmd, function(err, stdout, stderr){
            if (err) {
              console.error("**********  error at [runChrome] exec   *************");
              console.error(err)
              // chrome.shouldClose = true;
              // chrome.execute = undefined;
            }
            info("stdout:" + stdout.toString())
            warn("stderr:" + stderr.toString())
            // await timeout(1000);
          });
          chrome.execute.on("close", (code, signal) => {
            console.error("**********  error at [runChrome] listen on close   *************");
            console.error(`killed by ${signal}`);
            // chrome.shouldClose = true;
          })
          chrome.execute.on("error", (err) => {
            console.error("**********  error at [runChrome] listen on error   *************");
            console.error(err);
            // chrome.shouldClose = true;
          })
          chrome.pid = chrome.execute.pid;
          await timeout(1000);
          request(
            {
              timeout: 3000,
              url: `http://127.0.0.1:${chrome.port}/json/version`
            },
            (err: Error, res: request.Response, body: any) => {
            if (err) {
              console.error("**********  error at [runChrome] request.end   *************");
              console.error(err)
              chrome.shouldClose = true;
              chrome.execute = undefined;
            }
            if (typeof body === "string") {
              body = JSON.parse(body);
            }
            chrome.path = body.webSocketDebuggerUrl;
            chrome.birthTime = momentU.format();
            chrome.isClosed = false;
          })
      }
      
    } catch (e) {
      console.error("**********  error at [runChrome] catch   *************");
      console.error(e);
      process.exit(1);
    }
  }
  const releaseChrome = async (path: string) => {
    const chrome = chromes.find(chrome => {
      return chrome.path === path;
    });
    if (chrome) {
      chrome.shouldClose = true;
    }
  }
  /**
   * close one Chrome totally
   */
  const closeChrome = async () => {
    let pids: number[] = [];
    while (chromesShouldBeClose.length > 0) {
      const chrome = chromesShouldBeClose.shift();
      if (chrome) {
        chrome.execute && chrome.execute.kill("SIGINT");
        info(`killed chrome pid:${chrome.pid}`);
        chrome.execute = undefined;
        chrome.socket = undefined;
        chrome.path = undefined;
        chrome.birthTime = undefined;
        chrome.isClosed = true;
        chrome.startTime = "2000-01-01 00:00:00";
        chrome.pid && pids.push(chrome.pid);
        chrome.pid = undefined;
      } else {
        warn("chrome is undefind at [closeChrome]")
      }
    }
    /**
     * kill all childProcesses which parentProcess is pid;
     */
    await Promise.all(pids.map(pid => {
      return new Promise(res => {
        try {
          psTree(pid, function (err, children) {
            info(`kill childprocess of chrome of pid:${pid}`);
            const platform = os.platform();
            /**
             * support win32 linux platform for now ..ever
             */
            if (platform === "win32") {
              info(`cmd: taskkill ` + ['/t', '/f', '/pid'].concat(children.map(function (p) { return p.PID })))
              const pids = children.map(function (p) { return p.PID });
              for (const pid of pids) {
                spawn('taskkill', ['/t', '/f', '/pid'].concat(pid));
              }
            } else if (platform === "linux") {
              info(`cmd: kill ` + ['-9'].concat(children.map(function (p) { return p.PID })))
              psTree(pid, function (err, children) {
                spawn('kill', ['-9'].concat(children.map(function (p) { return p.PID })));
              });
            } else {
              throw new Error("unsupport platform:" + platform);
            }
            
            setTimeout(res, 2000);
          });
          // const stdout = execSync(`tasklist`);
          // console.log(stdout.toString());
        } catch (e) {
          console.error(e);
          throw Error("**********  error at [closeChrome] tasklist   *************");
        }
      })
    }))
  }
  /**
   * launch app for connection
   */
  const server = http.createServer((req, res) => {
    if(req.url && req.url.indexOf("/allocationChrome") >= 0) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({path: allowcateChrome()}));
    } else if(req.url && req.url.indexOf("/releaseChrome") >= 0) {
      let path = req.url.split("name=")[1];
      releaseChrome(path);
    }
  }).listen(3333, () => {
    info(`app start listen at 3333`);
  })
  /**
   * handle upgrade event for puppeteer.connect() function
   */
  server.on("upgrade", (req, socket, head) => {
      socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
                  'Upgrade: WebSocket\r\n' +
                  'Connection: Upgrade\r\n' +
                  '\r\n');
    
      socket.pipe(socket);
    }
  );
  /**
   * init chromes
   */
  const init = () => {
    config.chromes.forEach((chrome: {port: number}) => {
      chromes.push(new Chrome(chrome.port))
    })
  }
  init();
  /**
   * launch chromes
   */
  async function run () {
    while(true) {
      await checkPool();
      await closeChrome();
      await timeout(2000);
      await runChrome();
      console.log("**one tick pass---------->")
    }
  }
  run();
};
info("launch app")
launch();
