import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthDto } from './dto';
import * as argon from 'argon2';
import { Prisma } from '@prisma/client';
// import { PrismaClientKnownRequestError } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable({})
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  async signup(dto: AuthDto) {
    const hash = await argon.hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hash,
        },
        // For not return the Hash to the front-end
        // select: {
        //   id: true,
        //   email: true,
        //   createdAt: true,
        // },
      });
      //return JwtToken
      return this.signToken(user.id, user.email);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        if (error.code === 'P2002') {
          throw new HttpException(
            { reson: 'Credentials taken' },
            HttpStatus.FORBIDDEN,
          );
        }
      throw error;
    }
  }

  async signin(dto: AuthDto) {
    //find the User by email
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    //if user does not exsit throw exception
    if (!user) throw new ForbiddenException('Credentails incoorect');

    //compare password
    const pwMatches = await argon.verify(user.hash, dto.password);

    //if password incorrect throw exception
    if (!pwMatches) throw new ForbiddenException('Credentails incoorect');

    //send JwtToken
    return this.signToken(user.id, user.email);
  }
  async signToken(
    userId: number,
    email: string,
  ): Promise<{ access_token: string }> {
    const payload = {
      sub: userId,
      email,
    };

    const secret = this.config.get('JWT_SECRET');

    const token = await this.jwt.signAsync(payload, {
      expiresIn: '60m',
      secret: secret,
    });

    return {
      access_token: token,
    };
  }
}
