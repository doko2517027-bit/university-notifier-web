import { db, studentNumber } from "./common.js";
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

export function localDateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

async function stableId(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2,"0")).join("").slice(0,32);
}

export async function awardDailyQuestionPoints({ type, points, subjectId, subjectName, unitId, questionId }) {
    if (!studentNumber) return { awarded:false, points:0 };
    const day = localDateKey();
    const awardId = await stableId(`${day}|${type}|${subjectId}|${unitId}|${questionId}`);
    const subjectPointId = await stableId(subjectId || subjectName || "unknown");
    const awardRef = doc(db,"users",studentNumber,"solvedQuestions",awardId);
    const dailyRef = doc(db,"dailyRanking",day,"users",studentNumber);
    const totalRef = doc(db,"totalRanking",studentNumber);
    const subjectRef = doc(db,"users",studentNumber,"subjectPoints",subjectPointId);
    const subjectDayRef = doc(db,"users",studentNumber,"subjectPointHistory",`${day}_${subjectPointId}`);
    return runTransaction(db, async transaction => {
        if ((await transaction.get(awardRef)).exists()) return { awarded:false, points:0 };
        transaction.set(awardRef,{day,type,subjectId,unitId,questionId,points,correctAt:serverTimestamp()});
        transaction.set(dailyRef,{point:incrementValue(points),solved:incrementValue(1),lastAnsweredAt:serverTimestamp()},{merge:true});
        transaction.set(totalRef,{point:incrementValue(points),updatedAt:serverTimestamp()},{merge:true});
        transaction.set(subjectRef,{subjectId:subjectId || "",subjectName:subjectName || "名称未設定",point:incrementValue(points),updatedAt:serverTimestamp()},{merge:true});
        transaction.set(subjectDayRef,{day,subjectId:subjectId || "",subjectName:subjectName || "名称未設定",point:incrementValue(points),updatedAt:serverTimestamp()},{merge:true});
        return { awarded:true, points };
    });
}

// Firestore FieldValue.increment と同じ変換値。CDNの循環importを避けるため遅延利用する。
import { increment } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
function incrementValue(value) { return increment(value); }
