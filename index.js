const express = require("express");
const cors = require("cors");
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
// middlewares
app.use(cors());
app.use(express.json())

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
        console.log('database connected')
    } catch (error) {
        console.log(error)
    }
}
dbConnect().catch(error=>console.log(error));

// db collections

const appointmentOptionsCollections = client.db("Doctors-portal").collection('appointmentOptions')
const bookingCollections = client.db("Doctors-portal").collection('bookedAppoinment')

// get appoinmentOptions
app.get("/appoinmentOptions",async(req,res)=>{
  try {
    const query = {};
    const date = req.query.date;
    const bookingQuery = {appointmentDate:date}
    const options = await appointmentOptionsCollections.find(query).toArray();

    const alreadyBooked = await bookingCollections.find(bookingQuery).toArray();
    options.forEach(option =>{
      const optionBooked = alreadyBooked.filter(booked => booked.treatment === option.name)
      const bookedSlots = optionBooked.map(book => book.slot)
      const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
      option.slots = remainingSlots;
    })
   
    res.send(options)
  } catch (error) {
    console.log(error)
  }
})

app.post('/bookings',async(req,res)=>{
  const booking = req.body;
  const query = {
    email:booking.email,
    appointmentDate:booking.appointmentDate,
    treatment:booking.treatment
  }
  
  try {
    const alreadyBooked = await bookingCollections.find(query).toArray();
    if(alreadyBooked.length){
      return res.send({
        success:false,
        message:`You allready booked a appoinment of ${booking.treatment} on ${booking.appointmentDate}`
      })
    }
    
    const result = await bookingCollections.insertOne(booking);
    if(result.acknowledged){
      res.send({
        success:true,
        message:"Booking Confrimed"
      })
    }
    else{
      res.send({
        success:false,
        message:"Someting went wrong.please try again!"
      })
    }
  } catch (error) {
    console.log(error)
  }
})

app.get("/booking",async(req,res)=>{
  try {
    const query = {email:req.query.email}
    const result = await bookingCollections.find(query).toArray()
    if(result.length){
      res.send({
        success:true,
        booking:result
      })
    }
    else{
      res.send({
        success:false,
        booking:[]
      })
    }
  } catch (error) {
    console.log(error)
  }
})





// test server
app.get("/", (req, res) => {
  res.send("Doctors portal sever is running");
});

app.listen(port, () => {
  console.log("server is runing");
});
