/**
 * Builder for generating Dockerfiles for different service types
 * Follows Builder Pattern for flexible Dockerfile construction
 */
export class DockerfileBuilder {
  private lines: string[] = [];

  /**
   * Add FROM instruction
   */
  from(image: string): this {
    this.lines.push(`FROM ${image}`);
    return this;
  }

  /**
   * Add RUN instruction
   */
  run(command: string): this {
    this.lines.push(`RUN ${command}`);
    return this;
  }

  /**
   * Add WORKDIR instruction
   */
  workdir(path: string): this {
    this.lines.push(`WORKDIR ${path}`);
    return this;
  }

  /**
   * Add COPY instruction
   */
  copy(source: string, destination: string): this {
    this.lines.push(`COPY ${source} ${destination}`);
    return this;
  }

  /**
   * Add ENV instruction
   */
  env(key: string, value: string): this {
    this.lines.push(`ENV ${key}=${value}`);
    return this;
  }

  /**
   * Add ARG instruction
   */
  arg(name: string): this {
    this.lines.push(`ARG ${name}`);
    return this;
  }

  /**
   * Add EXPOSE instruction
   */
  expose(port: number): this {
    this.lines.push(`EXPOSE ${port}`);
    return this;
  }

  /**
   * Add CMD instruction
   */
  cmd(command: string[]): this {
    const cmdString = command.map((c) => JSON.stringify(c)).join(', ');
    this.lines.push(`CMD [${cmdString}]`);
    return this;
  }

  /**
   * Add raw line to Dockerfile
   */
  raw(line: string): this {
    this.lines.push(line);
    return this;
  }

  /**
   * Build and return the Dockerfile content
   */
  build(): string {
    return this.lines.join('\n');
  }

  /**
   * Reset builder to start fresh
   */
  reset(): this {
    this.lines = [];
    return this;
  }

  /**
   * Build a standard Node.js service Dockerfile
   */
  static buildNodeService(options: {
    envVars?: Record<string, string>;
    buildCommand?: string;
    startCommand?: string;
    port?: number;
  }): string {
    const builder = new DockerfileBuilder();

    builder
      .from('node:22-alpine')
      .run('apk add --no-cache git build-base python3')
      .run('npm install -g pnpm')
      .workdir('/app');

    // Add ARG instructions for build-time variables
    if (options.envVars) {
      Object.keys(options.envVars).forEach((key) => {
        builder.arg(key);
      });
    }

    builder.copy('package*.json pnpm-lock.yaml* ./', './').run('pnpm install').copy('. .', '.');

    // Add ENV instructions for runtime variables
    if (options.envVars) {
      Object.entries(options.envVars).forEach(([key, value]) => {
        builder.env(key, value);
      });
    }

    builder
      .run(options.buildCommand || 'pnpm build')
      .expose(options.port || 3000)
      .cmd(['sh', '-c', options.startCommand || 'pnpm start']);

    return builder.build();
  }

  /**
   * Build a static site Dockerfile with multi-stage build
   */
  static buildStaticSite(options: {
    envVars?: Record<string, string>;
    buildCommand?: string;
    staticOutputDir?: string;
  }): string {
    const builder = new DockerfileBuilder();

    // Build stage
    builder
      .from('node:22-alpine AS builder')
      .run('apk add --no-cache git')
      .run('npm install -g pnpm')
      .workdir('/app');

    // Add ARG instructions for build-time variables
    if (options.envVars) {
      Object.keys(options.envVars).forEach((key) => {
        builder.arg(key);
      });
    }

    builder.copy('package*.json pnpm-lock.yaml* ./', './').run('pnpm install').copy('. .', '.');

    // Add ENV instructions for build-time
    if (options.envVars) {
      Object.entries(options.envVars).forEach(([key, value]) => {
        builder.env(key, value);
      });
    }

    builder
      .run(options.buildCommand || 'pnpm build')
      .raw("RUN ls -R /app | grep ': ' || true")
      .raw('')
      .from('nginx:alpine')
      .run('rm -rf /usr/share/nginx/html/*')
      .copy(`--from=builder /app/${options.staticOutputDir || 'dist'}`, '/usr/share/nginx/html')
      .raw('COPY nginx.conf /etc/nginx/conf.d/default.conf')
      .expose(80)
      .cmd(['nginx', '-g', 'daemon off;']);

    return builder.build();
  }
}
