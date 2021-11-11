import * as dotenv from 'dotenv'
import axios from 'axios';
import { Telegraf, Context } from "telegraf";
dotenv.config()

interface KpData {
    time: Date;
    kp: number;
}

class AuroraBot {
    private bot: Telegraf<Context>;
    private CHANNEL_ID: number;

    constructor() {
        const TOKEN = process.env.BOT_TOKEN
        this.CHANNEL_ID = +(process.env.CHANNEL_ID ?? '0')
        if (!TOKEN || !this.CHANNEL_ID) {
            console.error('No token or channel id provided');
            process.exit(1);
        }

        this.bot = new Telegraf(TOKEN);
        this.bot.start((ctx: Context) => ctx.reply('Welcome!'));
        this.bot.command('k', (ctx) => this.lastK(ctx));
        this.bot.command('forecast', (ctx) => this.forecast(ctx));
        this.bot.command('history', (ctx) => this.history(ctx));

        this.bot.launch();
        console.log('Bot started');

        this.notifications()
    }

    private async getKpData(url: string): Promise<KpData[]> {
        const res = await axios.get(url);
        return res.data.slice(1).map((x: any) => ({
            time: new Date(x[0]),
            kp: +x[1]
        }))
    }

    private async getPastKp(): Promise<KpData[]> {
        return this.getKpData('http://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    }

    private async getMinuteKp(): Promise<KpData[]> {
        return this.getKpData('http://services.swpc.noaa.gov/products/noaa-estimated-planetary-k-index-1-minute.json');
    }

    private async getForecastKp(): Promise<KpData[]> {
        return this.getKpData('http://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json');
    }

    private notifications() {
        let lastNotification: null | Date = null;
        setInterval(async () => {
            if (!lastNotification || new Date().getTime() - lastNotification.getTime() > 1000 * 60 * 60) {
                const kp = (await this.getForecastKp()).filter(x => x.time >= new Date())[0].kp;
                if (kp >= 5) {
                    console.log('Sending notifications');
                    await this.bot.telegram.sendMessage(this.CHANNEL_ID, `Aurora is coming (maybe)!\nKP is ${kp}`);
                    lastNotification = new Date();
                }
            }
        }, 1000 * 60 * 5)
    }

    private getLine(d: KpData, minutes: boolean = false): string {
        const roundedKP = Math.min(8, Math.round(d.kp));
        const alert = ['🟢', '🟢', '🟢', '🔵', '🟣', '🟡', '🟠', '🔴', '🔴'][roundedKP];
        const bar = ''.padEnd(roundedKP, '█') + ''.padEnd(8 - roundedKP, '░');
        const date = minutes 
            ? ` ${d.time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
            : `${d.time.getDate().toString().padStart(2, '0')} ${d.time.toLocaleString('default', { month: 'short' })} - ${d.time.getHours().toString().padStart(2, '0')}h`;
        return `${alert}${d.kp.toFixed(1)} ${bar} ${date} `
    }

    private getLines(datas: KpData[], fullDate: boolean = false): string {
        return datas.map(x => this.getLine(x, fullDate)).join('\n');
    }

    private async lastK(ctx: Context) {
        console.log(ctx.from.id);
        const kpData = (await this.getMinuteKp()).slice(-50).filter((x, i) => i % 5 === 0);
        ctx.reply(`Last recorded Kp indexes:\n${this.getLines(kpData, true)}`);
    }

    private async forecast(ctx: Context) {
        const kpData = (await this.getForecastKp()).filter(x => x.time >= new Date());
        ctx.reply(`Forecasts:\n${this.getLines(kpData)}`);
    }

    private async history(ctx: Context) {
        const kpData = (await this.getPastKp()).slice(-10);
        ctx.reply(`Last recorded Kp indexes:\n${this.getLines(kpData)}`);
    }
}

new AuroraBot();
