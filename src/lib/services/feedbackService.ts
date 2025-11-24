import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs, 
  query, 
  orderBy, 
  where, 
  Timestamp,
  limit
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Feedback } from "@/lib/firebase/types";

export type FeedbackInput = Omit<Feedback, "id" | "status" | "createdAt" | "updatedAt">;

export const feedbackService = {
  /**
   * Submit new feedback
   */
  submitFeedback: async (input: FeedbackInput): Promise<string> => {
    const feedbackData = {
      ...input,
      status: "open",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, "feedback"), feedbackData);
    return docRef.id;
  },

  /**
   * Get all feedback (Admin only)
   */
  getAllFeedback: async (): Promise<Feedback[]> => {
    const q = query(
      collection(db, "feedback"), 
      orderBy("createdAt", "desc"),
      limit(100) // Reasonable limit for now
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Feedback));
  },

  /**
   * Get single feedback by ID (Admin only)
   */
  getFeedbackById: async (id: string): Promise<Feedback | null> => {
    const docRef = doc(db, "feedback", id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as Feedback;
    }
    
    return null;
  },

  /**
   * Update feedback status (Admin only)
   */
  updateStatus: async (id: string, status: Feedback["status"]): Promise<void> => {
    const docRef = doc(db, "feedback", id);
    await updateDoc(docRef, {
      status,
      updatedAt: Timestamp.now()
    });
  }
};

