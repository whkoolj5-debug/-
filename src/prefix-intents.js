import {ApplicationFlagsBitField,GatewayIntentBits,Routes} from 'discord.js';
const F=ApplicationFlagsBitField.Flags;
const hasContent=app=>new ApplicationFlagsBitField(app.flags||0).any([F.GatewayMessageContent,F.GatewayMessageContentLimited]);
export async function enablePrefixIntents(client,log=console.log,{autoEnable=true}={}){
 // discord.js freezes client intent fields; retain the new object returned by add().
 client.options.intents=client.options.intents.add(GatewayIntentBits.GuildMessages).freeze();
 let allowed=false;
 try{
  let app=await client.rest.get(Routes.currentApplication());
  allowed=hasContent(app);
  if(!allowed&&autoEnable&&(app.approximate_guild_count===undefined||app.approximate_guild_count<100)){
   // Discord's documented application edit endpoint only permits LIMITED intent flags.
   // Preserve the other limited flags; do not request or alter any other application settings.
   const editable=F.GatewayPresenceLimited|F.GatewayGuildMembersLimited|F.GatewayMessageContentLimited;
   const flags=((app.flags||0)&editable)|F.GatewayMessageContentLimited;
   try{
    const updated=await client.rest.patch(Routes.currentApplication(),{body:{flags}});
    allowed=hasContent(updated);
    if(!allowed){app=await client.rest.get(Routes.currentApplication());allowed=hasContent(app);}
    log(allowed?'Message Content enabled automatically. Plain !bal, !help and money commands are ready.':'Message Content is not enabled yet. Check the application settings.');
   }catch(error){
    log(`Message Content auto-enable was not permitted (${error.status||error.code||'API error'}). Enable it on the Developer Portal Bot page. Mention commands and poker remain available.`);
   }
  }
  if(allowed)client.options.intents=client.options.intents.add(GatewayIntentBits.MessageContent).freeze();
 }catch{
  log('Could not check application message permissions. Poker and mention commands remain available.');
 }
 log(`Gateway intents: GuildMessages=${client.options.intents.has(GatewayIntentBits.GuildMessages)}, MessageContent=${client.options.intents.has(GatewayIntentBits.MessageContent)}`);
 log(allowed?'Plain !bal commands are enabled (no mention needed).':'Plain !bal needs Message Content Intent. Until enabled, mention the bot before !bal.');
 return allowed;
}
