const { BOT_TOKEN } = require("./secrets")
const { Collection} = require('discord.js')
const fs = require("fs")
const { sumUserMessage, sumUserCommand } = require('./external/discord-22/service/user')
const { client } = require('./external/discord')

client.commands = new Collection()
const commandFiles = fs.readdirSync('./interactions/commands').filter(file => file.endsWith('.js'))
commandFiles.forEach(file => {
  const command = require(`./interactions/commands/${file}`)
  client.commands.set(command.data.name, command)
})

const reactions = new Collection()
const reactionsFiles = fs.readdirSync('./interactions/reactions').filter(file => file.endsWith('.js'))
reactionsFiles.forEach(file => {
  const reaction = require(`./interactions/reactions/${file}`)
  reactions.set(reaction.title, reaction)
})

const buttons = new Collection()
const buttonsFiles = fs.readdirSync('./interactions/buttons').filter(file => file.endsWith('.js'))
buttonsFiles.forEach(file => {
  const button = require(`./interactions/buttons/${file}`)
  buttons.set(file.replace(".js", ""), button)
})

const checkMessageReaction = async (reaction, user, func) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error)
      return
    }
  }
  if (reaction.message.author.id === client.user.id
    && reaction.message.embeds.length > 0
    && reaction.message.embeds[0].title.length > 0) {

    const reactionAction = reactions.get(reaction.message.embeds[0].title)
    if (!reactionAction) return

    try {
      await reactionAction[func](reaction, user)
    } catch (error) {
      console.error(error)
    }
  }
}

client.on('messageReactionAdd', async (reaction, user) => {
  await checkMessageReaction(reaction, user, "add")
})

client.on('messageReactionRemove', async (reaction, user) => {
  await checkMessageReaction(reaction, user, "remove")
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return
  if (!interaction.customId) return

  const [prefix, suffix] = interaction.customId.split(/_(.+)/)
  if (prefix && suffix) {
    const button = buttons.get(prefix)
    await button?.execute(interaction, suffix)
  } else {
    const button = buttons.get(interaction.customId)
    await button?.execute(interaction)
  }
})

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return

  const command = client.commands.get(interaction.commandName)
  if (!command) return

  try {
    await command.execute(client, interaction)
    await sumUserCommand({ user: interaction.user, count: 1 })
  } catch (error) {
    console.error(error)
    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
  }
})

client.on('messageCreate', async message => {
  if (!message.content.startsWith("/")) {
    await sumUserMessage({ user: message.author, count: 1 })
  }
})

client.once('ready', () => {
  console.log('Ready!')
})

client.login(BOT_TOKEN)
