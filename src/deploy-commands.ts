import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID  = process.env.DISCORD_GUILD_ID!; // tu servidor de pruebas

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Responde pong!').toJSON(),
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Comandos registrados en el guild.');
})();
