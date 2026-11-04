import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  // Vérifie santé
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "xyz-api",
      timestamp: new Date().toISOString(),
    };
  }
}
