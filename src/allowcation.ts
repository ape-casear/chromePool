import request from "request";

const _config = {
    hostAndPort: "127.0.0.1:3333",
}

export const sethostAndPort = (hostAndPort: string) => {
    _config.hostAndPort = hostAndPort;
}
/**
 * 获取chrome的endPoint用于puppeteer.connect
 */
export const allowcateChrome = async () => {
    return await new Promise(resolve => {
        request({
            timeout: 3000,
            method: "GET",
            url: `http://${_config.hostAndPort}/allocationChrome`
        }, (err: Error, res: request.Response, body: any) => {
            if (err) {
                console.error(err)
                throw err;
            }
            resolve(body)
        })
    })
}
/**
 * 释放chrome
 * @param path chrome的path
 */
export const releaseChrome = async (path: string) => {
    return await new Promise(resolve => {
        request({
            timeout: 3000,
            method: "GET",
            url: `http://${_config.hostAndPort}/releaseChrome?name=${path}`
        }, (err: Error, res: request.Response, body: any) => {
            if (err) {
                console.error(err)
                throw err;
            }
            resolve(body)
        })
    })
}