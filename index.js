const fs = require('fs');
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { Sequelize, DataTypes } = require('sequelize');
const { log } = require('console');
const fetch = require('node-fetch'); // Add this line to import the fetch function
const mongoose = require('mongoose');
const { Schema, model } = mongoose;
const axios = require('axios');


// Create the Discord client
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
let secondsPassed = 0;

client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
  console.log(`Code by Wick Studio`);
  console.log(`discord.gg/wicks`);

  setTimeout(() => {
    const channelId = '982548544974118937'; // Replace with your channel ID
    const channel = client.channels.cache.get(channelId);

    if (channel) {
      // sendNewYearMessage(channel);
    } else {
      console.error('Channel not found');
    }
  }, 100000000000); // Adjusted timeout to 19 hours and 30 minutes
});

// Connect to SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: false,
});

const Points = sequelize.define('Points', {
  guildId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  points: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

// Read configuration from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// User ID allowed to use the clear command
const allowedClearUserId = config.allowedClearUserId;

// Read questions from quiz.json
const quizData = JSON.parse(fs.readFileSync('quiz.json', 'utf8'));

// Read quotes from quotes.json
const quotesData = JSON.parse(fs.readFileSync('quotes.json', 'utf8'));

// Map to store user cooldowns
const quizCooldowns = new Map();

async function getPointsFromDatabase(guildId, userId) {
  try {
    let userPoints = await Points.findOne({ where: { guildId, userId } });
    if (!userPoints) {
      userPoints = await Points.create({ guildId, userId, points: 0 });
    }

    return userPoints.points;
  } catch (error) {
    console.error('Lỗi lấy điểm từ cơ sở dữ liệu:', error);
    return 0;
  }
}

// Define the InappropriateMessage model
const inappropriateMessageSchema = new Schema({
  content: { type: String, required: true },
  user: { type: String, required: true },
  idchannel: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const InappropriateMessage = model('InappropriateMessage', inappropriateMessageSchema);


async function handleInappropriateLanguage(message) {
  try {
    console.log('Message content:', message.content.toLowerCase());
    const user = message.author;
    console.log('User:', user.tag);
    const channelID = message.channel.id;
    console.log('Channel ID:', channelID);

    // Thêm điều kiện để kiểm tra ID của channel
    if (channelID === config.nocheckchannel) {
      console.log('Skipping inappropriate language check for this channel.');
      return;
    }

    const inappropriateWords = (config.texttoxic);
    await sendInappropriateMessageToAPI({
      user: message.author.tag,
      content: message.content,
      idchannel: channelID,
    });

    const hasInappropriateWord = inappropriateWords.some(word => message.content.toLowerCase().includes(word));

    if (hasInappropriateWord) {
      console.log('Inappropriate language detected!');

      const notificationChannel = message.guild.channels.cache.get(config.idChange);

      if (notificationChannel) {
        await notificationChannel.send('Warning: Đã phát hiện thấy ngôn ngữ không phù hợp trong tin nhắn.');
      } else {
        console.error('Notification channel not found');
      }

      const warningMessage = 'Lưu ý: Ngôn ngữ bạn sử dụng không phù hợp trong server này.';
      const reply = await message.reply({ content: warningMessage });

      try {
        if (message.author.dmChannel || (await message.author.createDM())) {
          await message.author.send(warningMessage);
        }
      } catch (sendError) {
        console.error('Error sending direct message:', sendError);
      }

      await message.delete();

      setTimeout(async () => {
        try {
          if (reply && !reply.deleted && reply.deletable) {
            await reply.delete();
          }
        } catch (deleteError) {
          console.error('Error deleting reply:', deleteError);
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Error handling inappropriate language:', error);
  }
}

async function sendInappropriateMessageToAPI({ content, user, idchannel }) {
  try {
    // Send a POST request to the API using 'node-fetch'
    const response = await fetch('http://localhost:3000/api/inappropriate-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, user, idchannel }),
    });

    if (response.ok) {
      console.log('Inappropriate message sent to API successfully.');
    } else {
      console.error('Failed to send inappropriate message to API:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending inappropriate message to API:', error);
  }
}

const yourUserId = '946092057989111843'; // Replace with your user ID
const outputFilePath = 'all_messages.txt';

async function fetchAllMessagesAndSendToAPI(guild, apiEndpoint) {
  try {
    const channels = guild.channels.cache.filter(channel => channel.isText());

    const allMessages = [];
    for (const [, channel] of channels) {
      const messages = await channel.messages.fetch({ limit: 100 }); // Fetch the last 100 messages per channel
      allMessages.push(...messages.values());
    }

    const messagesData = allMessages.map(message => ({
      author: {
        id: message.author.id,
        tag: message.author.tag,
      },
      content: message.content,
      channelID: message.channel.id,
      timestamp: message.createdTimestamp, // Add timestamp here
    }));

    // Send the messages data to the API
    await axios.post(apiEndpoint, { messages: messagesData });

  } catch (error) {
    console.error('Error fetching and sending messages:', error);
    throw error;
  }
}

async function handleSummaryCommand(message) {
  try {
    // Gửi yêu cầu đến API để lấy thông tin
    const response = await axios.post('http://localhost:3000/api/analyze');
    const data = response.data;

    // Chuẩn bị nội dung để gửi đến kênh
    const embed = new MessageEmbed()
      .setTitle('Summary')
      .setColor('#3498db'); // Màu xanh dương

    // Hiển thị tên và số lượng người dùng
    if (data.userCounts !== undefined) {
      const userCountFields = Object.entries(data.userCounts).map(([user, count]) => `${user}: ${count}`);
      const userCountsMessage = userCountFields.length ? userCountFields.toString() : 'No data available';
      embed.addField('User Counts', userCountsMessage);

    } else {
      embed.addField('User Counts', 'No data available');
    }

    // Hiển thị số lượng từ cấm nếu có
    if (data.wordCounts && data.wordCounts.đụ !== undefined && data.wordCounts.cc !== undefined) {
      embed.addField('Word Counts', `đụ: ${data.wordCounts.đụ}, cc: ${data.wordCounts.cc}`);
    } else {
      embed.addField('Word Counts', 'No data available');
    }

    // Hiển thị kênh sử dụng nhiều nhất
    if (data.mostUsedChannel !== undefined) {
      embed.addField('Most Used Channel', data.mostUsedChannel || 'No data available');
    } else {
      embed.addField('Most Used Channel', 'No data available');
    }

    // Gửi thông tin đến kênh cụ thể
    const channel = await client.channels.fetch(config.idChange);
    if (channel) {
      channel.send({ embeds: [embed] });
    } else {
      console.error('Invalid channel ID:', config.idChange);
    }
  } catch (error) {
    console.error('Error fetching and sending summary:', error);
    message.reply('Oops! Something went wrong while fetching the summary.');
  }
}

// Define the function to handle the /total command
async function handleTotalCommand(message) {
  try {
    // Extract the command from the message content
    const prefix = config.prefix || '!';
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Make sure the command is 'total'
    if (command !== 'total') {
      return;
    }

    // Make a GET request to the API endpoint
    const response = await axios.get('http://localhost:3000/api/inappropriate-messages/analysis');
    const data = response.data;

    // Create an embed with the fetched data, converting numeric values to strings
    const totalEmbed = {
      title: 'Total Analysis',
      color: '#3498db',
      fields: [
        { name: 'Total Messages', value: data.totalMessages.toString() },
        { name: 'Total Timestamp', value: data.totalTimestamp.toString() },
        { name: 'Total Users', value: data.totalUsers.toString() },
        { name: 'Most Active User', value: `${data.mostActiveUser.user} (${data.mostActiveUser.messageCount.toString()} messages)` },
      ],
    };

    // Send the embed to the channel
    message.channel.send({ embeds: [totalEmbed] });
  } catch (error) {
    console.error('Error fetching and sending total:', error);
    message.reply('Oops! Something went wrong while fetching the total data.');
  }
}




client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const prefix = config.prefix || '!';
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  if (command === 'var') {
    // message.reply({ content: quizData.varReply, ephemeral: true });
    sendQuizQuestion(message);
    if (quizCooldowns.has(message.author.id)) {
      // User has not answered the previous question, remind them
      message.reply({ content: 'Bạn hãy trả lời câu trước đã!', ephemeral: true });
    }

    quizCooldowns.set(message.author.id, true);
    setTimeout(() => {
      quizCooldowns.delete(message.author.id);
    }, 1000); // 10 seconds
  } else if (command === 'points') {
    displayLeaderboard(message);
  } else if (command === 'clear' && message.author.id === allowedClearUserId) {
    clearLeaderboard(message);
  } else if (command === 'tweet') {
    sendRandomQuote(message);
  }
  if (message.content.toLowerCase() === '/toxic') {
    handleSummaryCommand(message);
  }
  if (message.content.toLowerCase() === '/getall') {
    try {
      const guild = message.guild;
      const apiEndpoint = 'http://localhost:3000/api/getAll'; // Replace with your API endpoint

      await fetchAllMessagesAndSendToAPI(guild, apiEndpoint);
      message.reply('All messages have been sent to the API.');
    } catch (error) {
      console.error('Error executing /getAll:', error);
      message.reply('Oops! Something went wrong while fetching and sending messages.');
    }
  }
  await handleInappropriateLanguage(message);
  await handleTotalCommand(message);
});

async function sendQuizQuestion(message) {
  try {
    // Xáo trộn mảng quizData trước khi chọn một câu hỏi ngẫu nhiên
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
    // Xáo trộn mảng quizData
    shuffleArray(quizData);

    // Chọn một câu hỏi ngẫu nhiên từ mảng được xáo trộn
    const randomQuestion = quizData[Math.floor(Math.random() * quizData.length)];

    const content = `**${randomQuestion.question}**`;

    const options = randomQuestion.options.map((option, index) =>
      new MessageButton()
        .setCustomId(`option_${index}`)
        .setLabel(option)
        .setStyle('PRIMARY')

    );

    const rows = [];
    while (options.length > 0) {
      rows.push(new MessageActionRow().addComponents(options.splice(0, 5)));
    }

    // Gửi message với nhiều hàng

    const quizMessage = await message.reply({
      content: content,
      components: rows.flat(),
    });

    const filter = (interaction) => interaction.customId.startsWith('option_');
    const collector = message.channel.createMessageComponentCollector({
      filter,
      time: 60000, // 60 seconds timeout
      max: 1, // Chỉ cho phép tương tác một lần
    });

    collector.on('collect', async (interaction) => {
      // Kiểm tra xem tương tác đã được xác nhận chưa
      if (interaction.deferred || interaction.replied) {
        // Nếu đã xác nhận, thông báo rằng họ đã chọn câu trả lời
        await interaction.reply({ content: 'Bạn đã chọn câu trả lời!', ephemeral: true });
        return;
      }
      const selectedOption = interaction.customId.split('_')[1];
      if (randomQuestion.options[selectedOption] === randomQuestion.correctAnswer) {
        const user = interaction.user;
        // Acknowledge the interaction
        await interaction.deferReply({ ephemeral: true });
        // Send the reply
        await interaction.editReply({ content: `Chính xác! Bạn được 1 điểm. Tổng số điểm của bạn: ${await getPointsFromDatabase(interaction.guild.id, user.id)}` });
        // Increment points
        await incrementPointsInDatabase(interaction.guild.id, user.id);
      } else {
        // Acknowledge the interaction with an error message
        await interaction.reply({ content: 'Câu trả lời sai!', ephemeral: true });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        message.channel.send('Hết giờ! Chưa có ai trả lời.');
      }
    });


  } catch (error) {
    console.error('Lỗi gửi câu hỏi trắc nghiệm:', error);
  }
}

async function incrementPointsInDatabase(guildId, userId) {
  try {
    let userPoints = await Points.findOne({ where: { guildId, userId } });
    if (!userPoints) {
      userPoints = await Points.create({ guildId, userId, points: 0 });
    }

    userPoints.points++;

    await userPoints.save();
  } catch (error) {
    console.error('Lỗi tăng điểm trong cơ sở dữ liệu:', error);
  }
}

async function displayLeaderboard(message) {
  try {
    const topUsers = await Points.findAll({
      where: { guildId: message.guild.id },
      order: [['points', 'DESC']],
      limit: 10,
    });

    const embed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Bảng xếp hạng điểm')
      .setThumbnail('https://media.discordapp.net/attachments/1171933619766435882/1173031471947190432/leaderboard-icon-16.png?ex=656279b0&is=655004b0&hm=9fb95568d32acfcd23a6303da3c55ece85b191e536dac99102089bce30a5b15e&=&width=675&height=675')
      .setDescription('Top 10 người dùng có điểm cao nhất')
      .addFields(
        topUsers.map((user, index) => ({
          name: `#${index + 1} ${message.guild.members.cache.get(user.userId)?.user?.username || 'Người dùng không xác định'}`,
          value: `Points : ${user.points}`,
        }))
      );

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Lỗi hiển thị bảng xếp hạng:', error);
  }
}

async function clearLeaderboard(message) {
  try {
    await Points.destroy({ where: { guildId: message.guild.id } });

    message.channel.send('Bảng xếp hạng đã được xóa!');
  } catch (error) {
    console.error('Lỗi xóa bảng xếp hạng:', error);
    message.channel.send('Đã xảy ra lỗi khi xóa bảng xếp hạng.');
  }
}

function sendRandomQuote(message) {
  const randomQuote = quotesData[Math.floor(Math.random() * quotesData.length)];

  const embed = new MessageEmbed()
    .setColor('#3498db')
    .setThumbnail('https://media.discordapp.net/attachments/1171933619766435882/1173035016008237106/Quote.png?ex=65627cfd&is=655007fd&hm=36e692a29fbdaf512e7814f5d46555d76477c8a429bb2d37c1b73748adf96f6b&=&width=675&height=675')
    .setTitle('Trích dẫn Tweet')
    .setDescription(`*"${randomQuote.quote}"*`)
    .setFooter(`Được yêu cầu bởi ${message.author.username}`, message.author.displayAvatarURL({ dynamic: true }));

  message.channel.send({ embeds: [embed] });
}
sequelize.sync();

client.login(config.token);