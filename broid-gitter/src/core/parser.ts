import * as Promise from "bluebird";
import { default as broidSchemas, IActivityStream } from "broid-schemas";
import { cleanNulls, Logger } from "broid-utils";
import * as uuid from "node-uuid";
import * as R from "ramda";

export default class Parser {
  public serviceID: string;
  public generatorName: string;
  private logger: Logger;

  constructor(serviceID: string, logLevel: string) {
    this.serviceID = serviceID;
    this.generatorName = "gitter";
    this.logger = new Logger("parser", logLevel);
  }

  // Validate parsed data with Broid schema validator
  public validate(event: any): Promise<Object | null> {
    this.logger.debug("Validation process", { event });

    const parsed = cleanNulls(event);
    if (!parsed || R.isEmpty(parsed)) { return Promise.resolve(null); }

    if (!parsed.type) {
      this.logger.debug("Type not found.", { parsed });
      return Promise.resolve(null);
    }

    return broidSchemas(parsed, "activity")
      .then(() => parsed)
      .catch((err) => {
        this.logger.error(err);
        return null;
      });
  }

  // Convert normalized data to Broid schema
  public parse(event: any): Promise<Object | null> {
    this.logger.debug("Normalize process", { event });

    const normalized: any = cleanNulls(event);
    if (!normalized || R.isEmpty(normalized)) { return Promise.resolve(null); }

    const activitystreams = this.createActivityStream(normalized);

    activitystreams.actor = {
      id:  R.path(["data", "fromUser", "id"], normalized),
      name: R.path(["data", "fromUser", "username"], normalized),
      type: "Person",
    };

    activitystreams.target = {
      id: R.path(["room", "id"], normalized),
      name: R.path(["room", "name"], normalized),
      type: R.path(["room", "oneToOne"], normalized) ? "Person" : "Group",
    };

    activitystreams.object = {
      content: R.path(["data", "text"], normalized),
      id: R.path(["data", "id"], normalized) || this.createIdentifier(),
      type: "Note",
    };

    return Promise.resolve(activitystreams);
  }

  private createIdentifier(): string {
    return uuid.v4();
  }

  private createActivityStream(normalized: any): IActivityStream {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      "generator": {
        id: this.serviceID,
        name: this.generatorName,
        type: "Service",
      },
      "published": R.path(["data", "sent"], normalized) ? Math.floor(new Date(R.path(["data", "sent"], normalized)).getTime() / 1000) : Math.floor(Date.now() / 1000),
      "type": "Create",
    };
  }
}
