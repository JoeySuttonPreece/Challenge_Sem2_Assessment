import { Component } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/auth";
import { AngularFirestore, DocumentChangeAction } from "@angular/fire/firestore";
import { Observable } from "rxjs";
import { first, map } from "rxjs/operators";
import firebase from "firebase/app";
import "firebase/firestore";

interface CleanDocUser {
  id: string;
  data: {
    role: string;
    email: string;
    total: number;
  };
}

interface CleanDocGame {
  id: string;
  data: {
    date;
    venue: string;
    payment: string | {
      member: string;
      amount: number;
    };
  };
}

function snapsToData(snapshot: Observable<DocumentChangeAction<unknown>[]>) {
  return snapshot.pipe(
    map(actions => actions.map(a => ({
      data: a.payload.doc.data(),
      id: a.payload.doc.id,
    }))));
}

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent {

  user;

  email: string = "";
  password: string = "";

  pending: Observable<CleanDocUser[]>;
  members: Observable<CleanDocUser[]>;

  date: string = "2020-01-01";
  time: string = "00:00";
  venue: string = "";
  gamesUpcoming: Observable<CleanDocGame[]>;
  gamesPast: Observable<CleanDocGame[]>;
  selectedGame: string = "";
  amount: number = 0;
  member: string = "";

  constructor(private auth: AngularFireAuth, private firestore: AngularFirestore) {
    auth.user.subscribe(async user => {
      console.log(user ? user.uid : "logged out");
      let member = false;
      if (user) {
        let userDoc = (await this.firestore.collection("users").doc(user.uid).get().toPromise()).data() as Object;
        this.user = {
          ...user,
          ...userDoc,
        }

        if (this.user.role == "member") {
          member = true;
          this.pending = snapsToData(this.firestore.collection("users", ref => ref.where("role", "==", "pending")).snapshotChanges()) as unknown as Observable<CleanDocUser[]>;
          this.members = (snapsToData(this.firestore.collection("users", ref => ref.where("role", "==", "member")).snapshotChanges()) as unknown as Observable<CleanDocUser[]>);
          this.gamesUpcoming = snapsToData(this.firestore.collection("games", ref => ref.where("payment", "==", "pending")).snapshotChanges()) as unknown as Observable<CleanDocGame[]>;
          this.gamesPast = snapsToData(this.firestore.collection("games", ref => ref.where("payment.amount", ">", 0)).snapshotChanges()) as unknown as Observable<CleanDocGame[]>;
        }
      }
      if (!user || !member) {
        this.user = null;
        this.pending = null;
        this.members = null;
        this.gamesUpcoming = null;
        this.gamesPast = null;
      }
    });
  }

  async register() {
    try {
      if (this.email.length > 0 && this.password.length > 0) {
        let newUID = (await this.auth.createUserWithEmailAndPassword(this.email, this.password)).user.uid;
        await this.firestore.collection("users").doc(newUID).set({
          role: "pending",
          email: this.email,
          total: 0,
        });
      }
    } catch (e) { console.error(e) }
  }

  async login() {
    try {
      if (this.email.length > 0 && this.password.length > 0) {
        let creds = await this.auth.signInWithEmailAndPassword(this.email, this.password);
      }
    } catch (e) { console.error(e) }
  }

  async loginWithGoogle() {
    try {
      let user = (await this.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())).user;
      await this.firestore.collection("users").doc(user.uid).set({
        role: "pending",
        email: user.email,
        total: 0,
      });
    } catch (e) { console.error(e) }
  }

  async logout() {
    try {
      await this.auth.signOut();
    } catch (e) { console.error(e) }
  }

  async accept(uid) {
    try {
      await this.firestore.collection("users").doc(uid).update({ role: "member" });
    } catch (e) { console.error(e) }
  }

  async reject(uid) {
    try {
      await this.firestore.collection("users").doc(uid).update({ role: "rejected" });
    } catch (e) { console.error(e) }
  }

  async createGame() {
    try {
      if (this.date.length > 0 && this.time.length > 0 && this.venue.length > 0) {
        await this.firestore.collection("games").add({
          date: new Date(Date.parse(`${this.date} ${this.time}`)),
          venue: this.venue,
          payment: "pending",
        });
      }
    } catch (e) { console.error(e) }
  }

  async remove(id) {
    try {
      await this.firestore.collection("games").doc(id).delete();
    } catch (e) { console.error(e) }
  }

  async selectGame(id) {
    try {
      this.selectedGame = id;
    } catch (e) { console.error(e) }
  }

  async payGame() {
    try {
      if (this.amount > 0 && this.member.length > 0) {
        this.firestore.collection("games").doc(this.selectedGame).update({
          payment: {
            amount: this.amount,
            member: this.member,
          },
        });
        this.firestore.collection("users").doc(this.member).update({
          total: firebase.firestore.FieldValue.increment(this.amount),
        });
      }
    } catch (e) { console.error(e) }
  }

  findMember(uid) {
    return (member) => member.id == uid;
  }

}
