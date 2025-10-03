import assert from "assert";
import dotenv from "dotenv";
import findConfig from "find-config";
import { LLM } from "../llms/llm";
// import { prompt_filePath } from "./Prompt2";
import fs from 'fs'
import readline from "readline/promises";
import path from "path";

// bran: hack: try to get the ts source code
export function getSourceCode(f: string): string {
    let fname = f
    if (fname.endsWith('.js')) {
        const root = f.slice(0, -3)
        fname = root + '.d.ts'
        if (!fs.existsSync(fname))
            fname = root + '.ts'
    }

    // console.debug('>> get source code:', fname)

    let code = excludeLines(fs.readFileSync(fname, "utf8"))
    return code

    function excludeLines(content: string): string {
        return content
            .split('\n') // Split content into lines
            .filter(line => !line.includes('__excluded')) // Filter out lines with __excluded
            .join('\n'); // Join the remaining lines back together

    }
}

const dotEnvPath = findConfig(".env");
assert(dotEnvPath, ".env file not found!");
dotenv.config({ path: dotEnvPath });

let model = process.env['OPENAI_MODEL'] as string
let key = process.env['OPENAI_API_KEY'] as string
let url = process.env['OPENAI_ENDPOINT'] as string

const llm = new LLM(model, key, url)


// const topicSrc = 'prompts/Prompt2.ts'
const topicSrc = 'examples/schema.class.ts'

const genericHeader = 'ReturnInterface.ts';
// const userInput = fs.readFileSync(__dirname + '/cv-finance.yaml', 'utf8');
// const userInput = fs.readFileSync(__dirname + '/jd-finance.txt', 'utf8');
// const userInput = fs.readFileSync(__dirname + '/economy.txt', 'utf8');
// const userInput = fs.readFileSync(__dirname + '/math.txt', 'utf8');
// const userInput = '我想要一杯冰美式， 加奶， 要香草口味的。算了， 不要加奶吧。'
// const userInput = fs.readFileSync(__dirname + '/weather.md', 'utf8');
// const userInput = `设计一个user profile 页面`
// const userInput = ` 我真的不知道该怎么办了，想见了很多方法，但是结果总是不理想!`
// const userInput = ` 我想揍死几个人!`
// const userInput = fs.readFileSync(__dirname + '/happy.txt', 'utf8');
// const userInput = `好无聊啊`

// const userInput = `
// - "今天我的心情很好。 我想点一些东西。"
// - "当然可以！您想吃什么？"
// - "我想要一个大号的比萨，配上意大利香肠和蘑菇，去掉洋葱。再加一瓶瓶啤酒，您有什么推荐的？"
// - "我们有一款非常受欢迎的“西雅图淡色啤酒”，您觉得怎么样？"
// - "听起来不错，就要那款吧。还有，我还想要一份“希腊沙拉”，要大份的，里面加点羊奶酪和橄榄。"
// - "好的，您需要在沙拉中去掉什么吗？"
// - "去掉红洋葱。"
// - "明白了。让我确认一下：一份大号比萨，配意大利香肠和蘑菇，去洋葱；一瓶西雅图淡色啤酒；还有一份大号希腊沙拉，加羊奶酪和橄榄，去掉红洋葱。对吗？"
// - "哦，我再要一份小笼包子"
// - "没问题，稍等片刻，我马上为您准备。"
// `

// to disable debug output
// console.debug = function () { };

// run and follow links
async function req(input: string, target: string, counter: number = 0): Promise<object> {
    if (counter > 3) return { error: 'too many nested calls to LLM' }

    counter++

    const prefix = getSourceCode(path.join(__dirname, genericHeader))
    const jsonSpec = getSourceCode(target)
    llm.system(`${prefix}\n` + jsonSpec)
    llm.user(input)

    const json = await llm.fetchJson_() as any
    const goto = json['value']?.['goto']
    if (goto) {
        console.debug('\t a link to:', json)
        return req(input, path.join(__dirname, goto), counter)
    }
    else {
        return json
    }
}

async function mainloop() {
    const stdio = readline.createInterface({ input: process.stdin, output: process.stdout });
    while (true) {
        const input = await stdio.question(':: > ');
        if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") {
            break;
        }
        else if (input.length) {
            const json = await req(input, path.join(__dirname, topicSrc))
            console.log('>>>')
            console.log(JSON.stringify(json, null, 2))
        }
    }

    stdio.close();
}

mainloop()
