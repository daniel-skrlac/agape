package hr.agape.user.mapper;

import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.UserResponseDTO;
import org.mapstruct.Mapper;

@Mapper(componentModel = "cdi")
public interface UserMapper {
    UserResponseDTO toUserResponseDto(UserEntity user);
}
