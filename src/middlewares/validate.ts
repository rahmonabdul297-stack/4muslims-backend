import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

const Validate = (req: Request, res: Response, next: NextFunction) => {
  const err = validationResult(req);
if(!err.isEmpty()){
      return res.status(400).json({error:err.array()[0]?.msg})
}
  next();
};

export  {Validate}