require("dotenv").config();
const bodyParser = require("body-parser");
const cors = require("cors");
const dns = require("dns");
const express = require("express");
const mongoose = require("mongoose");

// Basic Configuration
const port = process.env.PORT || 3000;

const app = express();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const counterSchema = new mongoose.Schema({
	_id: { type: String, required: true },
	seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

const shortUrlSchema = new mongoose.Schema(
	{
		longUrl: { type: String, required: true },
		shortUrl: { type: Number, unique: true },
	},
	{ collection: "shortUrl" }
);

shortUrlSchema.pre("save", async function (next) {
	const doc = this;
	try {
		const counter = await Counter.findByIdAndUpdate(
			{ _id: "shortUrl" },
			{ $inc: { seq: 1 } },
			{ new: true, upsert: true }
		);
		doc.shortUrl = counter.seq;
		next();
	} catch (error) {
		next(error);
	}
});

const SUrl = mongoose.model("SUrl", shortUrlSchema);

app.use(cors());

app.use("/public", express.static(`${process.cwd()}/public`));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", function (req, res) {
	res.sendFile(process.cwd() + "/views/index.html");
});

app
	.route("/api/shorturl")
	.get((req, res) => {
		res.json({ error: "Invalid URL" });
	})
	.post((req, res) => {
		const urlPattern = /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
		if (urlPattern.test(req.body.url)) {
			const nUrl = req.body.url;
			const hostname = new URL(nUrl).hostname;

			dns.lookup(hostname, async (err) => {
				if (!err) {
					try {
						let shortenedUrl = await SUrl.findOne({ longUrl: nUrl });

						if (shortenedUrl) {
							res.send({ original_url: nUrl, short_url: shortenedUrl.shortUrl });
						} else {
							const url = new SUrl({ longUrl: nUrl });
							const result = await url.save();

							res.json({ original_url: nUrl, short_url: result.shortUrl });
						}
					} catch (error) {
						res.json({ error: "Database error" });
					}
				} else {
					res.json({ error: "Invalid URL" });
				}
			});
		} else {
			res.json({ error: "Invalid URL" });
		}
	});

app.route("/api/shorturl/:shortcode").get(async (req, res) => {
	try {
		const result = await SUrl.findOne({ shortUrl: req.params.shortcode });
		if (result) {
			res.redirect(result.longUrl);
		} else {
			res.json({ error: "Invalid Url" });
		}
	} catch (error) {
		res.json({ error: "Invalid Url" });
	}
});

app.listen(port, function () {
	console.log(`Listening on port ${port}`);
});
