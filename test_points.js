import { db, studentNumber } from "./common.js";
import { doc, runTransaction, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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
    const result = await runTransaction(db, async transaction => {
        if ((await transaction.get(awardRef)).exists()) return { awarded:false, points:0 };
        transaction.set(awardRef,{day,type,subjectId,unitId,questionId,points,correctAt:serverTimestamp()});
        transaction.set(dailyRef,{point:incrementValue(points),solved:incrementValue(1),lastAnsweredAt:serverTimestamp()},{merge:true});
        transaction.set(totalRef,{point:incrementValue(points),updatedAt:serverTimestamp()},{merge:true});
        return { awarded:true, points };
    });
    if (!result.awarded) return result;

    // 科目別の権限設定に問題があっても、デイリー・累積ポイントは止めない。
    const subjectData={subjectId:subjectId || "",subjectName:subjectName || "名称未設定",point:incrementValue(points),updatedAt:serverTimestamp()};
    const subjectRef=doc(db,"users",studentNumber,"subjectPoints",subjectPointId);
    const subjectDayRef=doc(db,"users",studentNumber,"subjectPointHistory",`${day}_${subjectPointId}`);
    const subjectResults=await Promise.allSettled([
        setDoc(subjectRef,subjectData,{merge:true}),
        setDoc(subjectDayRef,{...subjectData,day},{merge:true})
    ]);
    const subjectSaved=subjectResults.every(item=>item.status==="fulfilled");
    if(!subjectSaved) console.error("科目別ポイント保存エラー。Firestoreルールを確認してください。",subjectResults);
    return {...result,subjectSaved};
}

// Firestore FieldValue.increment と同じ変換値。CDNの循環importを避けるため遅延利用する。
import { increment } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
function incrementValue(value) { return increment(value); }
