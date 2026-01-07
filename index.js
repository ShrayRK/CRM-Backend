const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const { dbConnection } = require("./db/db.connect");
const Lead = require("./models/lead.models");
const SalesAgent = require("./models/salesAgent.models");
const Comment = require("./models/comment.models");
const Tag = require("./models/tag.models");

dbConnection();

const corsOptions = {
  origin: ["http://localhost:5173","https://crm-frontend-three-sooty.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.options("/", cors(corsOptions));

async function addLead(newLead) {
  const lead = new Lead(newLead);
  return await lead.save();
}

async function getAllLeads(filters = {}) {
  const query = {};

  if (filters.salesAgentId) query.salesAgentId = filters.salesAgentId;
  if (filters.status) query.status = filters.status;
  if (filters.source) query.source = filters.source;
  if (filters.tags) query.tags = { $in: filters.tags.split(",") };

  return await Lead.find(query).populate("salesAgentId");
}

async function getLeadById(id) {
  return await Lead.findById(id).populate("salesAgentId");
}

async function updateLead(id, data) {
  return await Lead.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).populate("salesAgentId");
}

async function deleteLead(id) {
  return await Lead.findByIdAndDelete(id);
}

async function deleteAgent(id) {
  return await SalesAgent.findByIdAndDelete(id);
}

app.post("/leads", async (req, res) => {
  try {
    const savedLead = await addLead(req.body);
    res.status(201).json(savedLead);
  } catch {
    res.status(400).json({ error: "Failed to create lead." });
  }
});

app.get("/leads", async (req, res) => {
  try {
    const leads = await getAllLeads(req.query);
    res.json(leads);
  } catch {
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

app.get("/leads/:id", async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    res.json(lead);
  } catch {
    res.status(500).json({ error: "Failed to fetch lead." });
  }
});

app.put("/leads/:id", async (req, res) => {
  try {
    const updatedLead = await updateLead(req.params.id, req.body);
    if (!updatedLead)
      return res.status(404).json({ error: "Lead not found." });
    res.json(updatedLead);
  } catch {
    res.status(400).json({ error: "Failed to update lead." });
  }
});

app.delete("/leads/:id", async (req, res) => {
  try {
    const deletedLead = await deleteLead(req.params.id);
    if (!deletedLead)
      return res.status(404).json({ error: "Lead not found." });
    res.json({ message: "Lead deleted." });
  } catch {
    res.status(500).json({ error: "Failed to delete lead." });
  }
});

app.delete("/agents/:id", async (req, res) => {
  try {
    const agentId = new mongoose.Types.ObjectId(req.params.id);

    const assignedLeads = await Lead.find({ salesAgentId: agentId });

    if (assignedLeads.length > 0) {
      return res.status(400).json({
        error: "Agent has assigned leads. Reassign or delete leads first."
      });
    }

    const deletedAgent = await SalesAgent.findByIdAndDelete(agentId);
    if (!deletedAgent)
      return res.status(404).json({ error: "Agent not found." });

    res.json({ message: "Agent deleted." });
  } catch {
    console.error(error);
    res.status(500).json({ error: "Failed to delete agent." });
  }
});


async function addAgent(newAgent) {
  const agent = new SalesAgent(newAgent);
  return await agent.save();
}

async function getAllAgents() {
  return await SalesAgent.find();
}

app.post("/agents", async (req, res) => {
  try {
    const agent = await addAgent(req.body);
    res.status(201).json(agent);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ error: "Agent with this email already exists." });
    }
    res.status(400).json({ error: "Failed to create agent." });
  }
});

app.get("/agents", async (req, res) => {
  try {
    const agents = await getAllAgents();
    res.json(agents);
  } catch {
    res.status(500).json({ error: "Failed to fetch agents." });
  }
});

async function addComment(leadId, newComment) {
  const lead = await Lead.findById(leadId);
  if (!lead) return null;

  const comment = new Comment({ ...newComment, lead: leadId });
  return await comment.save();
}

async function getCommentsByLead(leadId) {
  return await Comment.find({ lead: leadId })
    .populate("author", "name email")
    .sort({ createdAt: -1 });
}

async function deleteComment(commentId) {
  return await Comment.findByIdAndDelete(commentId);
}

app.post("/leads/:id/comments", async (req, res) => {
  try {
    const savedComment = await addComment(req.params.id, req.body);
    if (!savedComment)
      return res.status(404).json({ error: "Lead not found." });
    res.status(201).json(savedComment);
  } catch {
    res.status(400).json({ error: "Failed to add comment." });
  }
});

app.get("/leads/:id/comments", async (req, res) => {
  try {
    const comments = await getCommentsByLead(req.params.id);
    res.json(comments);
  } catch {
    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

app.delete("/comments/:id", async (req, res) => {
  try {
    const deleted = await deleteComment(req.params.id);
    if (!deleted)
      return res.status(404).json({ error: "Comment not found." });
    res.json({ message: "Comment deleted." });
  } catch {
    res.status(500).json({ error: "Failed to delete comment." });
  }
});

app.get("/report/last-week", async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const count = await Lead.countDocuments({
      createdAt: { $gte: oneWeekAgo },
    });

    res.json({ leadsCreatedLastWeek: count });
  } catch {
    res.status(500).json({ error: "Failed to fetch last week report." });
  }
});

app.get("/report/pipeline", async (req, res) => {
  try {
    const count = await Lead.countDocuments({
      status: { $ne: "Closed" },
    });
    res.json({ totalLeadsInPipeline: count });
  } catch {
    res.status(500).json({ error: "Failed to fetch pipeline report." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Anvaya backend running on port ${PORT}`);
});
