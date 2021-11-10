import * as dotenv from 'dotenv'
import axios from 'axios';
import { Telegraf, Context } from "telegraf";
dotenv.config()

interface KpData {
    time: string;
    kp: number;
    kpFrac: number;
}

class AuroraBot {
    private bot: Telegraf<Context>;

    constructor() {
        const TOKEN = process.env.BOT_TOKEN
        if (!TOKEN) {
            console.error('No token provided');
            process.exit(1);
        }

        this.bot = new Telegraf(TOKEN);
        this.bot.start((ctx: Context) => ctx.reply('Welcome!'));
        this.bot.command('k', (ctx) => this.lastK(ctx));
        this.bot.command('history', (ctx) => this.history(ctx));

        this.bot.launch();
        console.log('Bot started');
    }

    private async getKpData(): Promise<KpData[]> {
        const res = await axios.get('http://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
        return res.data.slice(1).map((x: any) => ({
            time: x[0].substring(5, 13),
            kp: +x[1],
            kpFrac: +x[2]
        }))
    }

    private getLine(d: KpData): string {
        const alert = d.kp >= 7 ? '🔴' : (d.kp >= 5 ? '🟡' : '🟢');
        return `${alert} ${d.time} - ${d.kp} (${d.kpFrac})`
    }


    private async lastK(ctx: Context) {
        const kpData = (await this.getKpData()).slice(-1)[0];
        ctx.reply(`Current Kp index:\n${this.getLine(kpData)}`);
    }

    private async history(ctx: Context) {
        const kpData = (await this.getKpData()).slice(-10);
        const response = `Last 10 Kp indexes:\n${kpData.map(x => this.getLine(x)).join('\n')}`;
        ctx.reply(response);
    }

}

new AuroraBot();
