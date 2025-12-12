const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// const { dbConnection } = require("./db/db.connect");
const { dbConnection } = require("./db/db.connect");
const Lead = require("./models/lead.models");
const SalesAgent = require("./models/sales.models");
const Comment = require("./models/comment.models");
const Tag = require("./models/tag.models");

dbConnection();

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

async function addLead(newLead) {
  try {
    const lead = new Lead(newLead);
    const savedLead = await lead.save();
    return savedLead;
  } catch (error) {
    throw error;
  }
}

async function getAllLeads(filters = {}) {
  try {
    const query = {};

    if (filters.salesAgent) query.salesAgent = filters.salesAgent;
    if (filters.status) query.status = filters.status;
    if (filters.source) query.source = filters.source;
    if (filters.tags) query.tags = { $in: filters.tags.split(",") };

    const leads = await Lead.find(query);
    return leads;
  } catch (error) {
    throw error;
  }
}

async function getLeadById(id) {
  try {
    const lead = await Lead.findById(id);
    return lead;
  } catch (error) {
    throw error;
  }
}

async function updateLead(id, data) {
  try {
    const updatedLead = await Lead.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    return updatedLead;
  } catch (error) {
    throw error;
  }
}

async function deleteLead(id) {
  try {
    const deletedLead = await Lead.findByIdAndDelete(id);
    return deletedLead;
  } catch (error) {
    throw error;
  }
}

app.post("/leads", async (req, res) => {
  try {
    const savedLead = await addLead(req.body);
    res.status(201).json(savedLead);
  } catch (error) {
    res.status(400).json({ error: "Failed to create lead." });
  }
});

app.get("/leads", async (req, res) => {
  try {
    const leads = await getAllLeads(req.query);
    if (leads.length === 0) {
      return res.status(404).json({ error: "No leads found." });
    }
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch leads." });
  }
});

app.get("/leads/:id", async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found." });
    }
    res.json(lead);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch lead." });
  }
});

app.put("/leads/:id", async (req, res) => {
  try {
    const updatedLead = await updateLead(req.params.id, req.body);
    if (!updatedLead) {
      return res.status(404).json({ error: "Lead not found." });
    }
    res.json(updatedLead);
  } catch (error) {
    res.status(400).json({ error: "Failed to update lead." });
  }
});

app.delete("/leads/:id", async (req, res) => {
  try {
    const deletedLead = await deleteLead(req.params.id);
    if (!deletedLead) {
      return res.status(404).json({ error: "Lead not found." });
    }
    res.json({ message: "Lead deleted." });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete lead." });
  }
});

async function addAgent(newAgent) {
  try {
    const agent = new SalesAgent(newAgent);
    const savedAgent = await agent.save();
    return savedAgent;
  } catch (error) {
    throw error;
  }
}

async function getAllAgents() {
  try {
    const agents = await SalesAgent.find();
    return agents;
  } catch (error) {
    throw error;
  }
}

app.post("/agents", async (req, res) => {
  try {
    const agent = await addAgent(req.body);
    res.status(201).json(agent);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Agent with this email already exists." });
    }
    res.status(400).json({ error: "Failed to create agent." });
  }
});

app.get("/agents", async (req, res) => {
  try {
    const agents = await getAllAgents();
    if (agents.length === 0) {
      return res.status(404).json({ error: "No agents found." });
    }
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch agents." });
  }
});

async function addComment(leadId, newComment) {
  try {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return null;
    }
    const comment = new Comment({ ...newComment, lead: leadId });
    const savedComment = await comment.save();
    return savedComment;
  } catch (error) {
    throw error;
  }
}

async function getCommentsByLead(leadId) {
  try {
    const comments = await Comment.find({ lead: leadId });
    return comments;
  } catch (error) {
    throw error;
  }
}

app.post("/leads/:id/comments", async (req, res) => {
  try {
    const savedComment = await addComment(req.params.id, req.body);
    if (!savedComment) {
      return res.status(404).json({ error: "Lead not found." });
    }
    res.status(201).json(savedComment);
  } catch (error) {
    res.status(400).json({ error: "Failed to add comment." });
  }
});

app.get("/leads/:id/comments", async (req, res) => {
  try {
    const comments = await getCommentsByLead(req.params.id);
    if (comments.length === 0) {
      return res.status(404).json({ error: "No comments found for this lead." });
    }
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comments." });
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
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch last week report." });
  }
});

app.get("/report/pipeline", async (req, res) => {
  try {
    const count = await Lead.countDocuments({
      status: { $ne: "Closed" },
    });

    res.json({ totalLeadsInPipeline: count });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pipeline report." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Anvaya backend running on port ${PORT}`);
});
