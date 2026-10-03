import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { resolve } from 'node:path';
import { backend, Keys, loadState, saveState } from './keys.mjs';

const token = process.env.DISCORD_BOT_TOKEN;
const adminKey = process.env.METAGAME_ADMIN_KEY;
if (!token || !adminKey) throw new Error('Configure DISCORD_BOT_TOKEN and METAGAME_ADMIN_KEY');
const stateFile = resolve(process.env.KEY_STATE_FILE || './data/keys.json');
const keys = new Keys(await loadState(stateFile), state => saveState(stateFile, state), backend(process.env.METAGAME_URL || 'http://127.0.0.1:61000', adminKey));
const client = new Client({intents: [GatewayIntentBits.Guilds]});
const rest = new REST({version: '10'}).setToken(token);
const command = new SlashCommandBuilder().setName('key').setDescription('Your Dauntless Revived access code')
  .setContexts(0, 1)
  .addSubcommand(option => option.setName('claim').setDescription('Receive your single-use code by direct message'))
  .addSubcommand(option => option.setName('status').setDescription('Check whether your code has been redeemed'));

client.once(Events.ClientReady, async () => {
  try {
    // Upsert only /key; preserve other commands owned by this bot.
    await rest.post(Routes.applicationCommands(client.application.id), {body: command.toJSON()});
    console.log('Revived key bot ready');
  } catch { console.error('Could not register /key'); await client.destroy(); process.exitCode = 1; }
});
const active = new Set();
const cooldown = new Map();
setInterval(() => { const now = Date.now(); for (const [id, until] of cooldown) if (until <= now) cooldown.delete(id); }, 60000).unref();
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'key') return;
  const id = interaction.user.id;
  try {
    await interaction.deferReply({flags: MessageFlags.Ephemeral});
    if (process.env.DISCORD_GUILD_ID && interaction.guildId && interaction.guildId !== process.env.DISCORD_GUILD_ID) {
      await interaction.editReply('Use this command in the Revived server or in a DM with me.'); return;
    }
    if (active.has(id) || Date.now() < (cooldown.get(id) || 0)) {
      await interaction.editReply('Your key request is being handled. Try again in a few seconds.'); return;
    }
    active.add(id); cooldown.set(id, Date.now() + 10000);
    try {
      const claim = interaction.options.getSubcommand() === 'claim';
      const result = await keys.run(id, claim);
      if (result.status === 'ready' && claim) {
        try {
          await interaction.user.send({content: `🔑 **Your Revived Code**\n\`\`\`\n${result.code}\n\`\`\`\nEnter this single-use code in the launcher's registration screen. Keep it private.\n**Clear skies, Slayer.**`, allowedMentions: {parse: []}});
          await interaction.editReply('🔑 **Key Sent**\nCheck your DMs for your Revived code.\n**Clear skies, Slayer.**');
        } catch { await interaction.editReply('I could not DM you. Enable direct messages, then run `/key claim` again. Your code is saved.'); }
      } else {
        const messages = {
          ready: '🔑 **Key Ready**\nYour code has not been redeemed. Run `/key claim` to receive it by DM.',
          redeemed: '🔑 **Key Accepted**\nYour Revived code has been redeemed successfully.\n**Clear skies, Slayer.**',
          none: '🔑 **No Key Yet**\nRun `/key claim` and I will send your code by DM.',
          pending: 'Your code is being prepared. Try `/key claim` again shortly.',
          revoked: 'Your code is unavailable. Contact the server team.',
        };
        await interaction.editReply(messages[result.status]);
      }
    } finally { active.delete(id); }
  } catch {
    console.error('Key interaction failed'); // Never log tokens, codes or Discord payloads.
    if (interaction.deferred) await interaction.editReply('The key service is unavailable. Please try again shortly.').catch(() => {});
  }
});
client.on(Events.Error, () => console.error('Discord connection error'));
process.on('SIGINT', () => client.destroy());
process.on('SIGTERM', () => client.destroy());
await client.login(token).catch(() => { console.error('Discord login failed'); process.exitCode = 1; });
