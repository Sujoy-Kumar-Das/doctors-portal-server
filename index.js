const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
// middlewares
app.use(cors());
app.use(express.json());

const jwtVerify = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.send({ message: "Unauthorization access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.Access_Tokken, (error, decoded) => {
    if (error) {
      return res.send({ message: "forbidern request" });
    }

    req.decoded = decoded;

    next();
  });
};

// db connect
const uri = `mongodb+srv://${process.env.db_user}:${process.env.db_password}@cluster0.j1u8ft3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function dbConnect() {
  try {
    await client.connect();
    console.log("database connected");
  } catch (error) {
    console.log(error);
  }
}
dbConnect().catch((error) => console.log(error));

// db collections

const appointmentOptionsCollections = client
  .db("Doctors-portal")
  .collection("appointmentOptions");
const bookingCollections = client
  .db("Doctors-portal")
  .collection("bookedAppoinment");
const usersCollections = client.db("Doctors-portal").collection("users");
const doctorssCollections = client.db("Doctors-portal").collection("doctors");

// get appoinmentOptions
app.get("/appoinmentOptions", async (req, res) => {
  try {
    const query = {};
    const date = req.query.date;
    const bookingQuery = { appointmentDate: date };
    const options = await appointmentOptionsCollections.find(query).toArray();

    const alreadyBooked = await bookingCollections.find(bookingQuery).toArray();
    options.forEach((option) => {
      const optionBooked = alreadyBooked.filter(
        (booked) => booked.treatment === option.name
      );
      const bookedSlots = optionBooked.map((book) => book.slot);
      const remainingSlots = option.slots.filter(
        (slot) => !bookedSlots.includes(slot)
      );
      option.slots = remainingSlots;
    });

    res.send(options);
  } catch (error) {
    console.log(error);
  }
});

app.get("/specialty", async (req, res) => {
  try {
    const query = {};
    const result = await appointmentOptionsCollections
      .find(query)
      .project({ name: 1 })
      .toArray();

    if (result.length) {
      res.send({
        success: true,
        specialty: result,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/bookings", async (req, res) => {
  const booking = req.body;
  const query = {
    email: booking.email,
    appointmentDate: booking.appointmentDate,
    treatment: booking.treatment,
  };

  try {
    const alreadyBooked = await bookingCollections.find(query).toArray();
    if (alreadyBooked.length) {
      return res.send({
        success: false,
        message: `You allready booked a appoinment of ${booking.treatment} on ${booking.appointmentDate}`,
      });
    }

    const result = await bookingCollections.insertOne(booking);
    if (result.acknowledged) {
      res.send({
        success: true,
        message: "Booking Confrimed",
      });
    } else {
      res.send({
        success: false,
        message: "Someting went wrong.please try again!",
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/booking", jwtVerify, async (req, res) => {
  try {
    const email = req.query.email;
    const query = { email: email };
    const decodedEmail = req.decoded;
    if (email !== decodedEmail) {
      res.status(401).send({ message: "forbiden access" });
    }
    const result = await bookingCollections.find(query).toArray();
    if (result.length) {
      res.send({
        success: true,
        booking: result,
      });
    } else {
      res.send({
        success: false,
        booking: [],
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/storeUser", async (req, res) => {
  try {
    const user = req.body;
    const userEmail = req.body.email;
    const query = { email: userEmail };
    const storedUser = await usersCollections.findOne(query);
    if (storedUser) {
      return res.send({
        success: true,
        message: "User already stored",
      });
    }
    const result = await usersCollections.insertOne(user);
    if (result.acknowledged) {
      res.send({
        success: true,
        message: "User created successfully",
      });
    } else {
      res.send({
        success: true,
        message: "Something went wrong",
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.get("/users", jwtVerify, async (req, res) => {
  const email = req.query.email;
  const decodedEmail = req.decoded;
  if (email !== decodedEmail) {
    return res.status(401).send({
      success: false,
      message: "Unauthorize access",
    });
  }
  try {
    const query = {};
    const result = await usersCollections.find(query).toArray();
    res.send({
      success: true,
      users: result,
    });
  } catch (error) {
    console.log(error);
  }
});

app.get("/user/admin/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const query = { email: email };
    const user = await usersCollections.findOne(query);

    const result = user?.role === "Admin";
    res.send({
      isAdmin: result,
    });
  } catch (error) {
    console.log(error);
  }
});

app.put("/user/admin/:id", jwtVerify, async (req, res) => {
  try {
    const email = req.decoded;
    const query = { email: email };
    const user = await usersCollections.findOne(query);
    if (user.role !== "Admin") {
      return res.send({
        success: false,
        message: "fobiden access",
      });
    }
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const options = { upsert: true };
    const updatedDoc = {
      $set: {
        role: "Admin",
      },
    };
    const result = await usersCollections.updateOne(
      filter,
      updatedDoc,
      options
    );

    if (result.acknowledged) {
      res.send({
        success: true,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/store-doctors", jwtVerify, async (req, res) => {
  try {
    const decodedEmail = req.decoded;
    const email = req.query.email;
    const name = req.query.doctorName;
    const query = { email: email };
    
    if (decodedEmail !== email) {
      return res.send({
        success: false,
        message: "Unautorized access !",
      });
    }
    
    const doctor = await doctorssCollections.find(query).toArray();
    if (doctor) {
      return res.send({
        success: false,
        message:`${name} is already exist!`
      });
    }

    const data = req.body;
    const result = await doctorssCollections.insertOne(data);
    if (result.acknowledged) {
      res.send({
        success: true,
        message:`${name} added as a doctor`
      });
    }
  } catch (error) {
    console.log(error);
  }
});
app.get("/store-doctors",jwtVerify, async(req,res)=>{
  try {
    const query = {};
    const email = req.query.email;
    const decodedEmail = req.decoded;
    const emailQuery = {email:email}
    const user =  await usersCollections.findOne(emailQuery)
    const isAdmin = user.role === "Admin"
    if(email !== decodedEmail){
      res.send({
        success:false,
        message:"Forbiden Access !"
      })
    }
    if(!isAdmin){
      return res.send(
        {
          success:false,
          message:"Unauthorized access"
        }
      )
    }
    const result = await doctorssCollections.find(query).toArray()
    if(result.length){
      res.send({
        success:true,
        doctors:result
      })
    }
    else{
      res.send({
        success:false,
        message:"Someting went wrong",
        doctors:[]
      })
    }
  } catch (error) {
    console.log(error)
  }
})

app.get("/jwt", async (req, res) => {
  try {
    const email = req.query.email;
    const query = { email: email };
    const user = await usersCollections.findOne(query);
    if (user) {
      const jwtTokken = jwt.sign(email, process.env.Access_Tokken);
      return res.send({ Access_Token: jwtTokken });
    }
    res.send({
      jwtTokken: "Unauthorized access!",
    });
  } catch (error) {
    console.log(error);
  }
});

// test server
app.get("/", (req, res) => {
  res.send("Doctors portal sever is running");
});

app.listen(port, () => {
  console.log("server is runing");
});
