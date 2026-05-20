import { Activity, Dribbble, CircleDot } from "lucide-react";

export const MOCK_CLUB = {
  id: "karaka-rfc",
  name: "Karaka RFC",
  logo: "https://storage.googleapis.com/birdfood-image-uploads/ais-dev-74wzavla4ctuej6qasu33q-406567407991/1744392919323-karaka-rfc-logo.png",
  adminId: "club-manager-1",
  joinCode: "KRK2026"
};

export const MOCK_TEAMS = [
  { id: "1", clubId: "karaka-rfc", name: "Karaka Premier", sport: "Soccer", logo: "https://picsum.photos/seed/karaka/100/100", members: 18, coach: "Coach Sarah", icon: Activity, joinCode: "KRK-P1" },
  { id: "2", clubId: "karaka-rfc", name: "Thunder Basketball", sport: "Basketball", logo: "https://picsum.photos/seed/basket/100/100", members: 12, coach: "Coach Mike", icon: Dribbble, joinCode: "THN-B1" },
  { id: "3", clubId: "karaka-rfc", name: "Red Sox Juniors", sport: "Baseball", logo: "https://picsum.photos/seed/baseball/100/100", members: 15, coach: "Coach Dave", icon: CircleDot, joinCode: "RSX-J1" },
  { id: "4", clubId: "karaka-rfc", name: "Steelers Elite", sport: "Rugby", logo: "https://picsum.photos/seed/rugby/100/100", members: 22, coach: "Coach John", icon: Activity, joinCode: "STL-E1" },
  { id: "5", clubId: "karaka-rfc", name: "Flyers", sport: "Netball", logo: "https://picsum.photos/seed/netball/100/100", members: 10, coach: "Coach Amy", icon: Dribbble, joinCode: "FLY-N1" },
  { id: "6", clubId: "karaka-rfc", name: "Titans", sport: "Football", logo: "https://picsum.photos/seed/football/100/100", members: 30, coach: "Coach Chris", icon: Activity, joinCode: "TTN-F1" },
  { id: "7", clubId: "karaka-rfc", name: "Swift Warriors", sport: "Volleyball", logo: "https://picsum.photos/seed/volly/100/100", members: 14, coach: "Coach Lisa", icon: CircleDot, joinCode: "SWF-V1" },
];

export const MOCK_LINEUP = [
  { id: "1", name: "Cody Johnson", position: "Stroke", number: "7" },
  { id: "2", name: "Liam Smith", position: "Goalkeeper", number: "1" },
  { id: "3", name: "Noah Williams", position: "Defender", number: "4" },
  { id: "4", name: "Oliver Brown", position: "Defender", number: "5" },
  { id: "5", name: "James Jones", position: "Midfield", number: "8" },
  { id: "6", name: "William Garcia", position: "Forward", number: "10" },
  { id: "7", name: "Lucas Miller", position: "Forward", number: "9" },
];

export const MOCK_SCHEDULE = [
  { id: "1", teamId: "1", type: "training", title: "Karaka Training", date: "Tuesday, Apr 7", time: "6:00 PM", location: "Field 2, Central Park", notes: "Full kit required" },
  { id: "2", teamId: "1", type: "match", title: "Karaka Vs. Pukekohe", date: "Saturday, Apr 12", time: "2:30 PM", location: "Karaka Sports Park", notes: "Arrival 1:30 PM" },
  { id: "3", teamId: "2", type: "training", title: "Thunder Tactical", date: "Thursday, Apr 9", time: "5:30 PM", location: "Clubhouse Room B", notes: "Bring notebooks" },
  { id: "4", teamId: "2", type: "match", title: "Thunder Vs. Tigers FC", date: "Saturday, Apr 18", time: "4:00 PM", location: "Central Park", notes: "Home game" },
  { id: "5", teamId: "1", type: "match", title: "Karaka Vs. Drury", date: "Saturday, Apr 19", time: "1:00 PM", location: "Drury Complex", notes: "Away game" },
  { id: "7", teamId: "1", type: "match", title: "Karaka Vs. Manurewa", date: "Saturday, Apr 26", time: "3:30 PM", location: "Karaka Sports Park", notes: "Home game" },
  { id: "6", teamId: "3", type: "training", title: "Red Sox Practice", date: "Thursday, Apr 9", time: "4:00 PM", location: "Diamond 1", notes: "Batting practice" },
  { id: "8", teamId: "4", type: "match", title: "Steelers Vs. Counties", date: "Thursday, Apr 9", time: "2:30 PM", location: "Navigation Homes", notes: "Main event" },
  { id: "9", teamId: "5", type: "match", title: "Flyers Vs. Storm", date: "Friday, Apr 10", time: "1:00 PM", location: "Bruce Pulman", notes: "League match" },
  { id: "10", teamId: "7", type: "match", title: "Warriors Vs. Spiking", date: "Saturday, Apr 19", time: "11:00 AM", location: "Arena 1", notes: "Division 1" },
];

export const MOCK_DOCUMENTS = [
  { id: "1", name: "Season Handbook 2026.pdf", size: "2.4 MB", type: "PDF" },
  { id: "2", name: "Team Tactics & Set Pieces.pdf", size: "1.1 MB", type: "PDF" },
  { id: "3", name: "Medical Consent Form.docx", size: "45 KB", type: "DOCX" },
  { id: "4", name: "Tournament Schedule.xlsx", size: "120 KB", type: "XLSX" },
];
