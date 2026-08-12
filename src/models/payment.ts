import { Schema } from "mongoose";
import type { paymentTypes } from "../types/payment.type.ts";

const paymentSchema = new Schema<paymentTypes>({
    userId:{
        type:String,
        required:true,
    },
   reference:{
    type:String,
    required:true,
   },
   plan:{
    type:String,
    
   },
   amount:{
    type:Number,
    required:true
   }

})