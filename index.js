const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const jwt = require('jsonwebtoken');
var cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: "Unauthorized" })
    }
    jwt.verify(token, process.env.JWR_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ message: "Unauthorized" })
        }
        req.decoded = decoded;
        next()
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bw0ezcs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        // job related api's
        const jobCollection = client.db("jobPortal").collection("jobs");
        const jobApplicationCollection = client.db("jobPortal").collection("job-application");

        // Auth related api'
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWR_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: false
            })
            res.send({ success: true })
        })

        app.get('/jobs', async (req, res) => {
            const email = req.query.email;
            let query = {}
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result)
        })


        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobCollection.findOne(query)
            res.send(result)
        })

        app.post('/jobs', async (req, res) => {
            const job = req.body;
            const result = await jobCollection.insertOne(job);
            res.send(result)
        })

        app.delete('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/jobApplication', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { applicant_email: email };

            if (req.decoded.email !== req.query.email) {
                res.status(403).send({ message: "Forbidden" })
            }

            const result = await jobApplicationCollection.find(query).toArray();
            const cookie = req.cookies
            console.log('cookies', cookie)

            // system 1
            for (const application of result) {
                // console.log(application.job_id)
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await jobCollection.findOne(query1)
                if (job) {
                    application.title = job.title;
                    application.logo = job.company_logo;
                    application.company = job.company;
                    application.location = job.location;
                }
            }
            res.send(result)

        })

        app.get('/job-applications/jobs/:job_id', async (req, res) => {

            const jobId = req.params.job_id;
            const query = { job_id: jobId }
            const result = await jobApplicationCollection.find(query).toArray();
            res.send(result)
        })

        app.patch('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        // delete operation:
        app.delete('/jobApplication', async (req, res) => {
            const id = req.query.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobApplicationCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/jobApplications', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application);
            res.send(result)

            // owo
            const id = application.job_id;
            const query = { _id: new ObjectId(id) }
            const job = await jobCollection.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1
            } else { newCount = 1 }

            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updateResult = await jobCollection.updateOne(filter, updateDoc)

        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('server is running')
})

app.listen(port, () => {
    console.log(`job is on port ${port}`)
})