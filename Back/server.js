const mongoose = require("mongoose");
const app = require("express")();
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});
const port = process.env.PORT || 8000;

const { User, Channel } = require("./schemas");

require("dotenv").config();
mongoose.set("strictQuery", false);


const start = async () => {
  try {
    await mongoose.connect(
      `mongodb+srv://root:root@cluster0.z4himox.mongodb.net/?retryWrites=true&w=majority`
    );
    httpServer.listen(port, () => console.log("Server started on port 8000"));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();

io.on("connection", socket => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("login", async name => {
    const actualUser = await User.findOne({ name }).exec();
    const actualsChannels = await Channel.find().exec();
    let user;
    if (!actualUser) {
      user = new User({ name });
      await user.save();
    } else {
      user = actualUser;
    }
    const actualUsers = await User.find().exec();
    return socket.emit("logged", {
      user: user,
      users: actualUsers,
      channels: actualsChannels
    });
  });

  socket.on("changeNickname", async data => {
    const name = data.name;
    const user = await User.findById(data._id).exec();
    user.name = name;
    await user.save();
  });
  socket.on("list", async name => {
    if (!name)
      return socket.emit("listChannels", {
        channels: await Channel.find({ isPrivate: false }).exec()
      });
    return socket.emit("listSpecificChannels", {
      channels: await Channel.find({ name: { $regex: name } })
    });
  });

  socket.on("createChannel", async data => {
    const creator = await User.findById(data._id).exec();
    const newChannel = new Channel({
      name: data.name,
      members: [creator],
      messages: [],
      isPrivate: false
    });
    await newChannel.save();
  });
  socket.on("deleteChannel", async data => {
    await Channel.deleteOne({ name: data.name });
  });

  socket.on("joinChannel", async data => {
    const channel = await Channel.findOne({ name: data.name }).exec();
    if (!channel || channel.isPrivate) return;
    const actualUser = await User.findById(data._id).exec();
    if (channel.members.find(user => user._id.equals(actualUser._id))) return;
    channel.members.push(actualUser);
    const message = {
      user: {
        _id: 1,
        name: "Bot"
      },
      timestamp: Date.now(),
      content: `${actualUser.name} join the channel.`
    };
    channel.messages.push(message);
    await channel.save();
    const channels = await Channel.find().exec();
    socket.emit("responseChannels", {
      channels,
      user: actualUser,
      currentChannel: data.currentChannel
    });
  });
  socket.on("quitChannel", async data => {
    const channel = await Channel.findOne({ name: data.name }).exec();
    const actualUser = await User.findById(data._id).exec();
    channel.members = channel.members.filter(
      user => !user._id.equals(actualUser._id)
    );
    const message = {
      user: {
        _id: 1,
        name: "Bot"
      },
      timestamp: Date.now(),
      content: `${actualUser.name} leave the channel.`
    };
    channel.messages.push(message);
    await channel.save();
    const channels = await Channel.find().exec();
    socket.emit("responseChannels", {
      channels,
      user: actualUser,
      currentChannel: data.currentChannel
    });
  });
  socket.on("listUsers", async data => {
    const channel = await Channel.findById(data.channel_id).exec();
    socket.emit("usersList", {
      members: channel.members
    });
  });
  socket.on("refreshChannels", async data => {
    const actualUser = await User.findById(data._id).exec();

    const channels = await Channel.find().exec();
    socket.emit("responseChannels", {
      channels,
      user: actualUser,
      currentChannel: data.currentChannel
    });
  });

  socket.on("sendMessage", async data => {
    const actualUser = await User.findById(data.user._id).exec();
    const channel = await Channel.findById(data.currentChannel._id).exec();
    const message = {
      user: actualUser,
      timestamp: Date.now(),
      content: data.message
    };
    channel.messages.push(message);

    await channel.save();
    const channels = await Channel.find().exec();

    socket.emit("responseChannels", {
      channels,
      user: actualUser,
      currentChannel: data.currentChannel
    });
    const users = await User.find().exec();

    io.emit("globalResponse", {
      channels,
      users
    });
  });
  socket.on("sendPrivateMessage", async data => {
    const actualUser = await User.findById(data.user._id).exec();
    const receiver = await User.findOne({ name: data.name });
    const channel = await Channel.findOne({
      $or: [
        { name: { $regex: `${actualUser._id} - ${receiver._id}` } },
        { name: { $regex: `${receiver._id} - ${actualUser._id}` } }
      ]
    });
    const msg = data.message.replace(`/msg ${receiver.name} `, "");
    const message = {
      user: actualUser,
      timestamp: Date.now(),
      content: msg
    };
    if (!channel) {
      const newChannel = new Channel({
        name: `${actualUser._id} - ${receiver._id}`,
        members: [actualUser, receiver],
        messages: [message],
        isPrivate: true
      });
      await newChannel.save();
      return;
    }
    channel.messages.push(message);

    await channel.save();
    const channels = await Channel.find().exec();
    const users = await User.find().exec();
    io.emit("globalResponse", {
      channels,
      users
    });
  });
});
