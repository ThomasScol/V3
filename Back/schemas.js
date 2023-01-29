const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String
});

const User = mongoose.model("User", userSchema);

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  members: {
    type: Array,
    required: true
  },
  messages: {
    type: Array,
    required: true
  },
  isPrivate: {
    type: Boolean,
    required: true
  }
});

const Channel = mongoose.model("Channel", channelSchema);

module.exports = { User, Channel };
