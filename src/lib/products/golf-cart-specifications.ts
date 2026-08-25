export type SpecificationField = { key: string; label: string; multiline?: boolean };
export type SpecificationSection = { title: string; fields: SpecificationField[] };

const fields = (values: Array<[string, string, boolean?]>): SpecificationField[] => values.map(([key, label, multiline]) => ({ key, label, multiline }));

export const golfCartSpecificationSections: SpecificationSection[] = [
  { title: "Seating & Configuration", fields: fields([["passengerCapacity", "Passenger Capacity"], ["seatingConfiguration", "Seating Configuration"], ["forwardFacingSeats", "Forward-Facing Seats"], ["rearFacingSeats", "Rear-Facing Seats"], ["lifted", "Lifted / Non-Lifted"], ["golfConfiguration", "Golf Configuration"], ["utilityConfiguration", "Utility Configuration"], ["vehicleClassification", "LSV / NEV / PTV Classification"]]) },
  { title: "Battery & Electrical", fields: fields([["systemVoltage", "System Voltage"], ["batteryChemistry", "Battery Chemistry"], ["batteryType", "Battery Type"], ["batteryBrand", "Battery Brand"], ["batteryModel", "Battery Model"], ["batteryCapacity", "Battery Capacity"], ["ampHours", "Amp Hours"], ["kilowattHours", "Kilowatt Hours"], ["chargerType", "Charger Type"], ["onboardCharger", "Onboard Charger"], ["chargingTime", "Charging Time"]]) },
  { title: "Motor & Performance", fields: fields([["motorType", "Motor Type"], ["motorPowerKw", "Motor Power (kW)"], ["motorHorsepower", "Motor Horsepower"], ["controllerBrand", "Controller Brand"], ["controllerAmperage", "Controller Amperage"], ["topSpeed", "Top Speed"], ["estimatedRange", "Estimated Range"], ["runningDistance", "Running Distance"], ["maximumGrade", "Maximum Grade / Climbing Ability"], ["acceleration", "Acceleration"]]) },
  { title: "Dimensions & Capacity", fields: fields([["overallLength", "Overall Length"], ["overallWidth", "Overall Width"], ["overallHeight", "Overall Height"], ["wheelbase", "Wheelbase"], ["groundClearance", "Ground Clearance"], ["turningRadius", "Turning Radius"], ["curbWeight", "Curb Weight / Vehicle Weight"], ["payloadCapacity", "Payload Capacity"], ["maximumLoadCapacity", "Maximum Load Capacity"], ["towingCapacity", "Towing Capacity"]]) },
  { title: "Frame, Suspension & Steering", fields: fields([["frameMaterial", "Frame Material"], ["aluminumFrame", "Aluminum Frame"], ["steelFrame", "Steel Frame"], ["chassisType", "Chassis Type"], ["frontSuspension", "Front Suspension"], ["rearSuspension", "Rear Suspension"], ["suspensionType", "Suspension Type"], ["liftKit", "Lift Kit"], ["liftHeight", "Lift Height"], ["steeringType", "Steering Type"], ["powerSteering", "Power Steering"]]) },
  { title: "Brakes, Wheels & Tires", fields: fields([["brakeType", "Brake Type"], ["frontBrakes", "Front Brakes"], ["rearBrakes", "Rear Brakes"], ["fourWheelDiscBrakes", "Four-Wheel Disc Brakes"], ["parkingBrake", "Parking Brake"], ["wheelSize", "Wheel Size"], ["tireSize", "Tire Size"], ["tireType", "Tire Type"], ["dotTires", "DOT Tires"]]) },
  { title: "Technology & Audio", fields: fields([["displaySize", "Display Size"], ["touchscreen", "Touchscreen"], ["digitalInstrumentCluster", "Digital Instrument Cluster"], ["infotainmentSystem", "Infotainment System"], ["bluetooth", "Bluetooth"], ["appleCarPlay", "Apple CarPlay"], ["androidAuto", "Android Auto"], ["usbCharging", "USB Charging"], ["wirelessCharging", "Wireless Charging"], ["backupCamera", "Backup Camera"], ["cameraSystem", "Camera System"], ["audioSystem", "Audio System"], ["speakers", "Speakers"], ["soundbar", "Soundbar"], ["subwoofer", "Subwoofer"]]) },
  { title: "Lighting & Safety", fields: fields([["headlights", "Headlights"], ["taillights", "Taillights"], ["brakeLights", "Brake Lights"], ["turnSignals", "Turn Signals"], ["daytimeRunningLights", "Daytime Running Lights"], ["interiorLighting", "Interior Lighting"], ["underbodyLighting", "Underbody Lighting"], ["overheadLighting", "Overhead Lighting"], ["lsvStatus", "LSV Status"], ["vin", "VIN"], ["dotEquipment", "DOT Equipment"], ["seatBelts", "Seat Belts"], ["threePointSeatBelts", "3-Point Seat Belts"], ["mirrors", "Mirrors"], ["horn", "Horn"], ["windshield", "Windshield"], ["windshieldWipers", "Windshield Wipers"], ["reflectors", "Reflectors"]]) },
  { title: "Comfort & Golf Equipment", fields: fields([["seatMaterial", "Seat Material"], ["premiumSeats", "Premium Seats"], ["armrests", "Armrests"], ["cupHolders", "Cup Holders"], ["storage", "Storage"], ["gloveBox", "Glove Box"], ["fans", "Fans"], ["cooler", "Cooler"], ["golfBagHolder", "Golf Bag Holder"], ["golfBagAttachment", "Golf Bag Attachment"], ["ballWasher", "Ball Washer"], ["sandBottle", "Sand Bottle"], ["scorecardHolder", "Scorecard Holder"], ["golfCooler", "Golf Cooler"], ["otherGolfAccessories", "Other Golf Accessories", true]]) },
  { title: "Warranty", fields: fields([["vehicleWarranty", "Vehicle Warranty"], ["batteryWarranty", "Battery Warranty"], ["powertrainWarranty", "Powertrain Warranty"], ["limitedWarrantyDetails", "Limited Warranty Details", true]]) },
  { title: "Features & Options", fields: fields([["standardFeatures", "Standard Features", true], ["optionalFeatures", "Optional Features", true], ["accessories", "Accessories", true], ["packages", "Packages", true], ["roofType", "Roof Type"], ["windshieldType", "Windshield Type"], ["bodyMaterial", "Body Material"], ["availableColors", "Available Colors", true], ["exteriorFinish", "Exterior Finish"]]) },
];

const aliases = new Map(golfCartSpecificationSections.flatMap((section) => section.fields.map((field) => [normalizeSpecificationKey(field.label), field.key])));
const commonAliases: Record<string, string> = {
  capacity: "passengerCapacity", seating: "seatingConfiguration", seats: "passengerCapacity", passengerCapacity: "passengerCapacity",
  battery: "batteryCapacity", batteryVoltage: "systemVoltage", voltage: "systemVoltage", batteryManufacturer: "batteryBrand",
  motor: "motorType", motorPower: "motorPowerKw", ratedMotor: "motorPowerKw", controller: "controllerAmperage", controllerOutput: "controllerAmperage",
  range: "estimatedRange", drivingRange: "estimatedRange", travelDistance: "estimatedRange", runningDistance: "runningDistance",
  maxSpeed: "topSpeed", maximumSpeed: "topSpeed", speed: "topSpeed", gradeability: "maximumGrade",
  length: "overallLength", width: "overallWidth", height: "overallHeight", vehicleWeight: "curbWeight", netWeight: "curbWeight", minimumTurningRadius: "turningRadius", minTurningRadius: "turningRadius", minGroundClearance: "groundClearance",
  frame: "frameMaterial", brakes: "brakeType", suspension: "suspensionType", wheels: "wheelSize", tires: "tireSize", multimedia: "infotainmentSystem", lighting: "headlights",
  lwh: "dimensions", "lWH": "dimensions",
};

export function normalizeSpecificationKey(value: string) {
  return value.replace(/\(kW\)/gi, " Kw").replace(/\bLSV\s*\/\s*NEV\s*\/\s*PTV\b/gi, " Vehicle Classification").replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase()).replace(/[^a-zA-Z0-9]/g, "");
}

export function canonicalGolfCartSpecificationKey(value: string) {
  const normalized = normalizeSpecificationKey(value);
  return aliases.get(normalized) || commonAliases[normalized] || value.trim();
}

export function normalizeGolfCartSpecifications(specifications: Record<string, string>) {
  return Object.fromEntries(Object.entries(specifications).map(([key, value]) => [canonicalGolfCartSpecificationKey(key), value]));
}

export function specificationLabel(key: string) {
  return golfCartSpecificationSections.flatMap((section) => section.fields).find((field) => field.key === key)?.label || key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}
