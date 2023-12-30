const fs = require('fs');
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const { Sequelize, DataTypes } = require('sequelize');
const { log } = require('console');

// Create the Discord client
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

let secondsPassed = 0;

// Log when the bot is online
client.once('ready', () => {
  console.log(`${client.user.tag} is online!`);
  console.log(`Code by Wick Studio`);
  console.log(`discord.gg/wicks`);

  setInterval(() => {
    secondsPassed += 3; // Tăng số giây lên 3 mỗi lần setInterval chạy
    console.log(`Seconds passed: ${secondsPassed}`);
  }, 3000);
  setTimeout(() => {
    const channel = client.channels.cache.get(''); // Replace YOUR_CHANNEL_ID with the ID of the channel where you want to send the message
    if (channel) {
      channel.send(`Chào cả nhóm tại Discord VALORANT,
        Chúng ta đã trải qua một năm đầy ý nghĩa và gắn bó tại Discord VALORANT. Tôi muốn gửi lời cảm ơn sâu sắc đến tất cả mọi người vì những khoảnh khắc tuyệt vời mà chúng ta đã chia sẻ cùng nhau trong suốt năm vừa qua.
        
        Năm nay, chúng ta đã có cơ hội cùng nhau thảo luận về các chiến thuật trong game, chia sẻ những trải nghiệm đầy kịch tính từ những trận đấu, và tạo ra những kỷ niệm đáng nhớ. Nhờ sự tích cực và tận tụy của mỗi người, Discord VALORANT trở thành một cộng đồng đặc biệt, nơi chúng ta có thể thảo luận và kết nối với những người đam mê VALORANT giống nhau.
        
        Tôi muốn cảm ơn mỗi thành viên đã đóng góp vào không khí tích cực và hỗ trợ lẫn nhau. Đặc biệt, cảm ơn các bạn đã thực hiện những sự kiện và hoạt động trong cộng đồng, tạo ra những trải nghiệm thú vị và động viên tinh thần cho tất cả mọi người.
        
        Chúc mừng năm mới, hy vọng chúng ta sẽ tiếp tục xây dựng và phát triển Discord VALORANT thành một nơi giao lưu thân thiện và năng động. Hãy cùng nhau tạo nên nhiều kỷ niệm mới và chia sẻ niềm đam mê của mình với VALORANT.
        
        Cảm ơn bạn đã làm cho năm vừa qua trở nên đặc biệt. Hẹn gặp lại tất cả mọi người trong những chặng đường mới của chúng ta!
        
        Trân trọng,
        IQUEENVV`);
      channel.send('https://cdn.discordapp.com/attachments/982548729041145876/1190760664592027770/407346939_3524267321118486_2667520437455933368_n.png?ex=65a2f949&is=65908449&hm=2e42b4f1ba1ab2f0b969a3b68aa5997ac871734cc03c5c0443c7ccfb84baeec2&');
      channel.send('HAPPY NEW YEAR!!!!');
      channel.send('https://tenor.com/view/tiger-year-of-the-tiger-lunar-new-year-happy-new-year-chinese-new-year-gif-24676864');
      channel.send('@everyone');
      channel.send('ACB 3488061 VO VAN HAU NHE');
    } else {
      console.error('Channel not found');
    }
  }, 70200000); // 3000 milliseconds = 3 seconds
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

client.on('messageCreate', (message) => {
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
      // } else {
      //   // User has already answered a question, proceed with the next question
      //   console.log(rep1);
      //   message.reply({ content: 'Bạn hãy trả lời câu trước đã!', ephemeral: true });
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


    // const embed = new MessageEmbed()
    //   .setColor('#4e5058')
    //   .setTitle('Trò chơi đố vui')
    //   .setThumbnail('https://cdn.discordapp.com/attachments/1084617747897536694/1189660921744855060/407346939_3524267321118486_2667520437455933368_n.png?ex=659ef912&is=658c8412&hm=528b7e984c98641faf774ad4d4438551460a4c519b25e2fe245c0d5cb84a6300&')
    //   .setDescription(`**${randomQuestion.question}**`);
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
