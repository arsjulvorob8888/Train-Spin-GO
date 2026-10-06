import { ALL } from "./legacy-ranges";
import { emptyMix, type MixRange } from "./mix";

/** One color per cell: the action with the biggest share on the GTOBase chart. */
export type BbSize = "x" | "2" | "2.5" | "3" | "3.5" | "4" | "4.5" | "5" | "6" | "6.5" | "8" | "ai";

export const SIZE_ORDER: BbSize[] = ["x", "2", "2.5", "3", "3.5", "4", "4.5", "5", "6", "6.5", "8", "ai"];

/** Check stays the app's call green. Raises step from amber to red. All-in is the dark red. */
export const SIZE_HEX: Record<BbSize, string> = {
  x: "#2f9e73",
  "2": "#ff9f1a",
  "2.5": "#ff7a1a",
  "3": "#f2552a",
  "3.5": "#e23b3b",
  "4": "#d12a4a",
  "4.5": "#c01e58",
  "5": "#a81868",
  "6": "#8c1460",
  "6.5": "#741458",
  "8": "#5c1048",
  ai: "#7d1f1f",
};

const DEPTHS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 25, 30];

const KNOWN: Record<number, Record<string, BbSize>> = {
5: {AA:"2",AKs:"2",AQs:"2",AJs:"ai",ATs:"ai",A9s:"ai",A8s:"ai",A7s:"ai",A6s:"ai",A5s:"ai",A4s:"ai",A3s:"ai",A2s:"ai",AKo:"2",KK:"2",KQs:"ai",KJs:"ai",KTs:"ai",K9s:"ai",K8s:"ai",K7s:"ai",K6s:"ai",K5s:"ai",K4s:"ai",K3s:"ai",K2s:"ai",AQo:"2",KQo:"ai",QQ:"2",QJs:"ai",QTs:"ai",Q9s:"ai",Q8s:"ai",Q7s:"ai",Q6s:"ai",Q5s:"ai",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"ai",KJo:"ai",QJo:"ai",JJ:"2",JTs:"ai",J9s:"ai",J8s:"ai",J7s:"ai",J6s:"ai",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"ai",KTo:"ai",QTo:"ai",JTo:"ai",TT:"ai",T9s:"ai",T8s:"ai",T7s:"ai",T6s:"ai",T5s:"ai",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai",K9o:"ai",Q9o:"ai",J9o:"ai",T9o:"ai","99":"ai","98s":"ai","97s":"ai","96s":"ai","95s":"ai","94s":"ai","93s":"ai","92s":"ai",A8o:"ai",K8o:"ai","88":"ai","87s":"ai","86s":"ai","85s":"ai","84s":"ai","83s":"ai","82s":"ai",A7o:"ai","77":"ai","76s":"ai","75s":"ai","74s":"ai","73s":"ai","72s":"ai",A6o:"ai","66":"ai","65s":"ai","64s":"ai","63s":"ai","62s":"ai",A5o:"ai","55":"ai","54s":"ai","53s":"ai","52s":"ai",A4o:"ai","44":"ai","43s":"ai","42s":"ai",A3o:"ai","33":"ai","32s":"ai",A2o:"ai","22":"ai"},
  6: {AA:"2",AKs:"2",AQs:"2",AJs:"2",ATs:"2",A9s:"2",A8s:"ai",A7s:"ai",A6s:"ai",A5s:"ai",A4s:"ai",A3s:"ai",A2s:"ai",AKo:"2",KK:"2",KQs:"2",KJs:"2",KTs:"ai",K9s:"ai",K8s:"ai",K7s:"ai",K6s:"ai",K5s:"ai",K4s:"ai",K3s:"ai",K2s:"ai",AQo:"2",KQo:"2",QQ:"2",QJs:"ai",QTs:"ai",Q9s:"ai",Q8s:"ai",Q7s:"ai",Q6s:"ai",Q5s:"ai",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"2",KJo:"ai",QJo:"ai",JJ:"2",JTs:"ai",J9s:"ai",J8s:"ai",J7s:"ai",J6s:"ai",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"ai",KTo:"ai",QTo:"ai",JTo:"ai",TT:"2",T9s:"ai",T8s:"ai",T7s:"ai",T6s:"ai",T5s:"ai",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai",K9o:"ai",Q9o:"ai","99":"ai","98s":"ai","97s":"ai","96s":"ai","95s":"ai","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"ai","87s":"ai","86s":"ai","85s":"ai","84s":"ai","83s":"ai","82s":"ai",A7o:"ai","77":"ai","76s":"ai","75s":"ai","74s":"ai","73s":"ai","72s":"ai",A6o:"ai","66":"ai","65s":"ai","64s":"ai","63s":"ai","62s":"ai",A5o:"ai","55":"ai","54s":"ai","53s":"ai","52s":"ai",A4o:"ai","44":"ai","43s":"ai","42s":"ai",A3o:"ai","33":"ai","32s":"ai",A2o:"ai","22":"ai"},
  7: {AA:"2",AKs:"2",AQs:"2",AJs:"2",ATs:"2",A9s:"2",A8s:"2",A7s:"3.5",A6s:"3.5",A5s:"3.5",A4s:"3.5",A3s:"3.5",A2s:"3.5",AKo:"2",KK:"2",KQs:"2",KJs:"2",KTs:"2",K9s:"3.5",K8s:"3.5",K7s:"3.5",K6s:"3.5",K5s:"3.5",K4s:"3.5",K3s:"ai",K2s:"ai",AQo:"2",KQo:"2",QQ:"2",QJs:"2",QTs:"3.5",Q9s:"3.5",Q8s:"3.5",Q7s:"3.5",Q6s:"3.5",Q5s:"3.5",Q4s:"3.5",Q3s:"3.5",Q2s:"ai",AJo:"2",KJo:"ai",QJo:"ai",JJ:"2",JTs:"3.5",J9s:"3.5",J8s:"3.5",J7s:"3.5",J6s:"3.5",J5s:"3.5",J4s:"3.5",J3s:"3.5",J2s:"ai",ATo:"2",KTo:"ai",QTo:"ai",JTo:"ai",TT:"2",T9s:"3.5",T8s:"3.5",T7s:"3.5",T6s:"3.5",T5s:"3.5",T4s:"3.5",T3s:"3.5",T2s:"ai",A9o:"3.5",K9o:"ai",Q9o:"ai",J9o:"ai",T9o:"ai","99":"2","98s":"3.5","97s":"3.5","96s":"3.5","95s":"3.5","94s":"3.5","93s":"3.5","92s":"3.5",A8o:"3.5",K8o:"ai",Q8o:"ai","88":"3.5","87s":"3.5","86s":"3.5","85s":"3.5","84s":"3.5","83s":"3.5","82s":"3.5",A7o:"3.5","77":"3.5","76s":"3.5","75s":"3.5","74s":"3.5","73s":"3.5","72s":"3.5",A6o:"ai","66":"3.5","65s":"3.5","64s":"3.5","63s":"3.5","62s":"3.5",A5o:"ai","55":"3.5","54s":"3.5","53s":"3.5","52s":"3.5",A4o:"ai","44":"3.5","43s":"3.5","42s":"3.5",A3o:"ai","33":"3.5","32s":"3.5",A2o:"ai","22":"3.5"},
  8: {AA:"2",AKs:"2",AQs:"2",AJs:"2.5",ATs:"2.5",A9s:"2.5",A8s:"3.5",A7s:"2.5",A6s:"2.5",A5s:"3.5",A4s:"3.5",A3s:"3.5",A2s:"3.5",AKo:"2",KK:"2",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"2.5",K8s:"3.5",K7s:"3.5",K6s:"3.5",K5s:"3.5",K4s:"3.5",K3s:"ai",K2s:"ai",AQo:"2.5",KQo:"2.5",QQ:"2",QJs:"3.5",QTs:"2.5",Q9s:"2.5",Q8s:"2.5",Q7s:"3.5",Q6s:"3.5",Q5s:"3.5",Q4s:"3.5",Q3s:"ai",Q2s:"ai",AJo:"2.5",KJo:"ai",QJo:"ai",JJ:"2.5",JTs:"2.5",J9s:"2.5",J8s:"2.5",J7s:"3.5",J6s:"3.5",J5s:"3.5",J4s:"3.5",J3s:"ai",J2s:"ai",ATo:"3.5",KTo:"ai",QTo:"ai",JTo:"ai",TT:"2.5",T9s:"2.5",T8s:"2.5",T7s:"3.5",T6s:"3.5",T5s:"3.5",T4s:"3.5",T3s:"3.5",T2s:"ai",A9o:"3.5",K9o:"ai",Q9o:"ai",J9o:"ai",T9o:"ai","99":"2.5","98s":"2.5","97s":"2.5","96s":"3.5","95s":"3.5","94s":"3.5","93s":"3.5","92s":"ai",A8o:"3.5",K8o:"ai",Q8o:"ai","88":"2.5","87s":"2.5","86s":"3.5","85s":"3.5","84s":"3.5","83s":"3.5","82s":"3.5",A7o:"ai","77":"3.5","76s":"2.5","75s":"3.5","74s":"3.5","73s":"3.5","72s":"3.5",A6o:"ai","66":"3.5","65s":"3.5","64s":"3.5","63s":"3.5","62s":"3.5",A5o:"ai","55":"3.5","54s":"3.5","53s":"3.5","52s":"3.5",A4o:"ai","44":"3.5","43s":"3.5","42s":"3.5",A3o:"ai","33":"3.5","32s":"3.5",A2o:"ai","22":"3.5"},
  9: {AA:"2",AKs:"2",AQs:"2.5",AJs:"2.5",ATs:"2.5",A9s:"2.5",A8s:"4",A7s:"2.5",A6s:"2.5",A5s:"4",A4s:"4",A3s:"4",A2s:"ai",AKo:"2",KK:"2",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"2.5",K8s:"4",K7s:"4",K6s:"4",K5s:"4",K4s:"ai",K3s:"ai",K2s:"ai",AQo:"2.5",KQo:"2.5",QQ:"2.5",QJs:"4",QTs:"2.5",Q9s:"2.5",Q8s:"2.5",Q7s:"4",Q6s:"4",Q5s:"4",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"2.5",KJo:"ai",QJo:"ai",JJ:"2.5",JTs:"2.5",J9s:"2.5",J8s:"2.5",J7s:"4",J6s:"4",J5s:"4",J4s:"4",J3s:"ai",J2s:"ai",ATo:"2.5",KTo:"ai",QTo:"ai",JTo:"ai",TT:"2.5",T9s:"2.5",T8s:"2.5",T7s:"2.5",T6s:"4",T5s:"4",T4s:"4",T3s:"ai",T2s:"ai",A9o:"4",K9o:"ai",Q9o:"ai",J9o:"ai",T9o:"ai","99":"2.5","98s":"2.5","97s":"2.5","96s":"4","95s":"4","94s":"4","93s":"ai","92s":"ai",A8o:"ai","88":"2.5","87s":"2.5","86s":"4","85s":"4","84s":"4","83s":"4","82s":"ai",A7o:"ai","77":"4","76s":"2.5","75s":"4","74s":"4","73s":"4","72s":"ai",A6o:"ai","66":"4","65s":"4","64s":"4","63s":"4","62s":"4",A5o:"ai","55":"4","54s":"4","53s":"4","52s":"4",A4o:"ai","44":"4","43s":"4","42s":"4",A3o:"ai","33":"4","32s":"4",A2o:"ai","22":"ai"},
  10: {AA:"2.5",AKs:"2.5",AQs:"2.5",AJs:"2.5",ATs:"2.5",A9s:"2.5",A8s:"2.5",A7s:"2.5",A6s:"4",A5s:"4",A4s:"4",A3s:"4",A2s:"ai",AKo:"2.5",KK:"2.5",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"2.5",K8s:"4",K7s:"4",K6s:"4",K5s:"ai",K4s:"ai",K3s:"ai",K2s:"ai",AQo:"2.5",KQo:"2.5",QQ:"2.5",QJs:"2.5",QTs:"2.5",Q9s:"2.5",Q8s:"4",Q7s:"4",Q6s:"4",Q5s:"4",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"2.5",KJo:"ai",QJo:"ai",JJ:"2.5",JTs:"2.5",J9s:"2.5",J8s:"4",J7s:"4",J6s:"4",J5s:"4",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"2.5",KTo:"ai",QTo:"ai",JTo:"ai",TT:"2.5",T9s:"2.5",T8s:"2.5",T7s:"4",T6s:"4",T5s:"4",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai",K9o:"ai","99":"2.5","98s":"2.5","97s":"4","96s":"4","95s":"4","94s":"4","93s":"ai","92s":"ai",A8o:"ai","88":"4","87s":"2.5","86s":"4","85s":"4","84s":"4","83s":"ai","82s":"ai",A7o:"ai","77":"4","76s":"4","75s":"4","74s":"4","73s":"4","72s":"ai",A6o:"ai","66":"4","65s":"4","64s":"4","63s":"4","62s":"ai",A5o:"ai","55":"4","54s":"4","53s":"4","52s":"4",A4o:"ai","44":"4","43s":"4","42s":"4",A3o:"ai","33":"ai","32s":"4",A2o:"ai","22":"ai"},
  11: {AA:"2.5",AKs:"2.5",AQs:"2.5",AJs:"2.5",ATs:"2.5",A9s:"2.5",A8s:"2.5",A7s:"2.5",A6s:"4",A5s:"4",A4s:"4",A3s:"ai",A2s:"ai",AKo:"2.5",KK:"2.5",KQs:"2.5",KJs:"2.5",KTs:"2.5",K9s:"2.5",K8s:"4",K7s:"4",K6s:"4",K5s:"ai",K4s:"ai",K3s:"ai",K2s:"ai",AQo:"2.5",KQo:"2.5",QQ:"2.5",QJs:"2.5",QTs:"2.5",Q9s:"2.5",Q8s:"4",Q7s:"4",Q6s:"4",Q5s:"ai",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"2.5",KJo:"ai",QJo:"ai",JJ:"2.5",JTs:"2.5",J9s:"2.5",J8s:"4",J7s:"4",J6s:"4",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"2.5",KTo:"ai",TT:"2.5",T9s:"2.5",T8s:"2.5",T7s:"4",T6s:"4",T5s:"4",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"2.5","98s":"2.5","97s":"4","96s":"4","95s":"4","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"4","87s":"2.5","86s":"4","85s":"4","84s":"4","83s":"ai","82s":"ai",A7o:"ai","77":"4","76s":"4","75s":"4","74s":"4","73s":"ai","72s":"ai",A6o:"ai","66":"4","65s":"4","64s":"4","63s":"4","62s":"ai",A5o:"ai","55":"4","54s":"4","53s":"4","52s":"ai",A4o:"ai","44":"ai","43s":"4","42s":"4",A3o:"ai","33":"ai","32s":"4",A2o:"ai","22":"ai"},
  12: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"4.5",A4s:"4.5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"3",K7s:"4.5",K6s:"ai",K5s:"ai",K4s:"ai",K3s:"ai",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"4.5",Q6s:"4.5",Q5s:"ai",Q4s:"ai",Q3s:"ai",Q2s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"3",J6s:"4.5",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"4.5",T5s:"4.5",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"4.5","95s":"4.5","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"4.5","84s":"4.5","83s":"ai","82s":"ai",A7o:"ai","77":"3","76s":"3","75s":"4.5","74s":"4.5","73s":"ai","72s":"ai",A6o:"ai","66":"4.5","65s":"3","64s":"4.5","63s":"4.5","62s":"ai",A5o:"ai","55":"4.5","54s":"4.5","53s":"4.5","52s":"ai",A4o:"ai","44":"ai","43s":"4.5","42s":"ai",A3o:"ai","33":"ai","32s":"4.5",A2o:"ai","22":"ai"},
  13: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"4.5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"3",K7s:"4.5",K6s:"ai",K5s:"ai",K4s:"ai",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"4.5",Q6s:"ai",Q5s:"ai",Q4s:"ai",Q3s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"3",J6s:"4.5",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"4.5",T5s:"ai",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"4.5","95s":"4.5","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"4.5","84s":"ai","83s":"ai","82s":"ai",A7o:"ai","77":"3","76s":"3","75s":"4.5","74s":"4.5","73s":"ai","72s":"ai",A6o:"ai","66":"4.5","65s":"3","64s":"4.5","63s":"ai","62s":"ai",A5o:"ai","55":"4.5","54s":"4.5","53s":"4.5","52s":"ai",A4o:"ai","44":"ai","43s":"4.5","42s":"ai",A3o:"ai","33":"ai","32s":"4.5",A2o:"ai","22":"ai"},
  14: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"4.5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"3",K7s:"ai",K6s:"ai",K5s:"ai",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"4.5",Q6s:"ai",Q5s:"ai",Q4s:"ai",Q3s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"4.5",J6s:"ai",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"4.5",T5s:"ai",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"4.5","95s":"ai","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"4.5","84s":"ai","83s":"ai","82s":"ai",A7o:"ai","77":"3","76s":"3","75s":"4.5","74s":"ai","73s":"ai","72s":"ai",A6o:"ai","66":"ai","65s":"3","64s":"ai","63s":"ai","62s":"ai",A5o:"ai","55":"ai","54s":"4.5","53s":"ai","52s":"ai",A4o:"ai","44":"ai","43s":"ai","42s":"ai",A3o:"ai","33":"ai","32s":"ai",A2o:"ai","22":"ai"},
  16: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"3",K7s:"ai",K6s:"ai",K5s:"ai",K4s:"ai",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"5",Q6s:"ai",Q5s:"ai",Q4s:"ai",Q3s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"5",J6s:"ai",J5s:"ai",J4s:"ai",J3s:"ai",J2s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"5",T5s:"ai",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"5","95s":"ai","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"5","84s":"ai","83s":"ai","82s":"ai",A7o:"ai","77":"3","76s":"3","75s":"5","74s":"ai","73s":"ai","72s":"ai",A6o:"ai","66":"5","65s":"3","64s":"5","63s":"ai","62s":"ai",A5o:"ai","55":"ai","54s":"5","53s":"ai","52s":"ai",A4o:"ai","44":"ai","43s":"5","42s":"ai",A3o:"ai","33":"ai","32s":"ai",A2o:"ai","22":"ai"},
  18: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"6",A4s:"6",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"3",K7s:"6",K6s:"ai",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"6",Q6s:"6",Q5s:"ai",Q4s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"6",J6s:"6",J5s:"ai",J4s:"ai",J3s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"6",T5s:"6",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"6","95s":"6","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"6","84s":"6","83s":"ai","82s":"ai",A7o:"ai","77":"3","76s":"3","75s":"6","74s":"6","73s":"ai","72s":"ai",A6o:"ai","66":"6","65s":"3","64s":"6","63s":"ai","62s":"ai",A5o:"ai","55":"6","54s":"6","53s":"6","52s":"ai",A4o:"ai","44":"ai","43s":"6","42s":"ai",A3o:"ai","33":"ai","32s":"6",A2o:"ai","22":"ai"},
  20: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"3",A4s:"6.5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"3",K7s:"6.5",K6s:"6.5",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"3",Q6s:"6.5",Q5s:"ai",Q4s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"3",J6s:"6.5",J5s:"6.5",J4s:"ai",J3s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"3",T5s:"6.5",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"3","95s":"6.5","94s":"6.5","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"6.5","84s":"6.5","83s":"ai","82s":"ai",A7o:"ai","77":"3","76s":"3","75s":"3","74s":"6.5","73s":"6.5","72s":"ai",A6o:"ai","66":"6.5","65s":"3","64s":"6.5","63s":"6.5","62s":"ai",A5o:"ai","55":"6.5","54s":"3","53s":"6.5","52s":"ai",A4o:"ai","44":"ai","43s":"6.5","42s":"6.5",A3o:"ai","33":"ai","32s":"6.5",A2o:"ai","22":"ai"},
  22: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"3",A8s:"3",A7s:"3",A6s:"3",A5s:"4.5",A4s:"6.5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"3",K9s:"3",K8s:"4.5",K7s:"4.5",K6s:"ai",AQo:"3",KQo:"3",QQ:"3",QJs:"3",QTs:"3",Q9s:"3",Q8s:"3",Q7s:"4.5",Q6s:"6.5",Q5s:"ai",AJo:"3",JJ:"3",JTs:"3",J9s:"3",J8s:"3",J7s:"4.5",J6s:"4.5",J5s:"ai",J4s:"ai",ATo:"3",TT:"3",T9s:"3",T8s:"3",T7s:"3",T6s:"4.5",T5s:"6.5",T4s:"ai",T3s:"ai",T2s:"ai",A9o:"ai","99":"3","98s":"3","97s":"3","96s":"4.5","95s":"4.5","94s":"ai","93s":"ai","92s":"ai",A8o:"ai","88":"3","87s":"3","86s":"3","85s":"4.5","84s":"6.5","83s":"ai","82s":"ai",A7o:"ai","77":"4.5","76s":"3","75s":"4.5","74s":"4.5","73s":"ai","72s":"ai",A6o:"ai","66":"4.5","65s":"4.5","64s":"4.5","63s":"6.5","62s":"ai",A5o:"ai","55":"6.5","54s":"4.5","53s":"4.5","52s":"ai",A4o:"ai","44":"ai","43s":"4.5","42s":"ai",A3o:"ai","33":"ai","32s":"4.5",A2o:"ai","22":"ai"},
  25: {AA:"3",AKs:"3",AQs:"3",AJs:"3",ATs:"3",A9s:"4.5",A8s:"4.5",A7s:"4.5",A6s:"4.5",A5s:"4.5",A4s:"4.5",AKo:"3",KK:"3",KQs:"3",KJs:"3",KTs:"4.5",K9s:"4.5",K8s:"4.5",K7s:"4.5",K6s:"6.5",AQo:"3",KQo:"3",QQ:"3",QJs:"4.5",QTs:"4.5",Q9s:"4.5",Q8s:"4.5",Q7s:"4.5",Q6s:"4.5",AJo:"3",JJ:"3",JTs:"4.5",J9s:"4.5",J8s:"4.5",J7s:"4.5",J6s:"4.5",J5s:"6.5",ATo:"4.5",TT:"3",T9s:"4.5",T8s:"4.5",T7s:"4.5",T6s:"4.5",T5s:"4.5",T4s:"ai",T3s:"ai",A9o:"ai","99":"4.5","98s":"4.5","97s":"4.5","96s":"4.5","95s":"4.5","94s":"6.5","93s":"ai","92s":"ai",A8o:"ai","88":"4.5","87s":"4.5","86s":"4.5","85s":"4.5","84s":"4.5","83s":"ai","82s":"ai",A7o:"ai","77":"4.5","76s":"4.5","75s":"4.5","74s":"4.5","73s":"6.5","72s":"ai",A6o:"ai","66":"4.5","65s":"4.5","64s":"4.5","63s":"6.5","62s":"ai",A5o:"ai","55":"4.5","54s":"4.5","53s":"4.5","52s":"6.5",A4o:"ai","44":"6.5","43s":"4.5","42s":"6.5",A3o:"ai","33":"ai","32s":"4.5",A2o:"ai","22":"ai"},
  30: {
    AA: "3", AKs: "3", AQs: "3", AJs: "3", ATs: "5", A9s: "5", A8s: "3", A7s: "3", A6s: "3",
    KK: "3", KQs: "5", KJs: "3", KTs: "3", KQo: "3", KJo: "3",
    QQ: "5", QJs: "5", QTs: "3", QJo: "3", JJ: "5", TT: "5", "99": "3", "88": "3", "77": "5", "66": "5",
    "74s": "3", "42s": "3", "32s": "3",
    AKo: "5", AQo: "5", AJo: "ai", ATo: "ai", A9o: "ai", A8o: "ai", A7o: "5",
    "85s": "ai", "76s": "ai", "65s": "ai", "55": "ai", "44": "ai", "33": "ai", "22": "ai",
  },
};


export function huBbLimpPaint(bb: number): Record<string, BbSize> {
  const depth = Math.max(1, Math.min(30, Math.round(bb)));
  let best = DEPTHS[0]!;
  for (const key of DEPTHS) {
    const gap = Math.abs(key - depth);
    const bestGap = Math.abs(best - depth);
    if (gap < bestGap || (gap === bestGap && key > best)) best = key;
  }
  const src = KNOWN[best]!;
  const out: Record<string, BbSize> = {};
  for (const hand of ALL) out[hand] = src[hand] ?? "x";
  return out;
}

export function huBbLimpRange(bb: number): MixRange {
  const paint = huBbLimpPaint(bb);
  const out: MixRange = {};
  for (const hand of ALL) {
    const mix = emptyMix();
    const size = paint[hand] ?? "x";
    if (size === "x") mix.call = 100;
    else if (size === "ai") mix.allin = 100;
    else mix.raise = 100;
    out[hand] = mix;
  }
  return out;
}

export function sizeCaption(size: string, bb: number): string {
  if (size === "x" || size === "call") return "Check";
  if (size === "ai" || size === "allin") return `All-in ${bb}`;
  if (size === "fold") return "Fold";
  if (size === "raise") return "Raise";
  return `Raise ${size}`;
}

export function sizeMark(size: string): string {
  if (size === "ai") return "AI";
  if (SIZE_HEX[size as BbSize] && size !== "x") return size;
  return "";
}

export function paintHex(action: string): string | null {
  return SIZE_HEX[action as BbSize] ?? null;
}
