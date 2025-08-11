import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN     = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID  = process.env.DISCORD_GUILD_ID!;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Faltan variables: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Responde pong!').toJSON(),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('✅ Comandos registrados en el guild.');
})();
